import React, { useState, useEffect } from 'react';
import { 
    Clock, 
    Play, 
    RefreshCw, 
    CheckCircle2, 
    XCircle, 
    Loader2, 
    Calendar, 
    Database, 
    ChevronRight, 
    FileText, 
    AlertCircle, 
    TrendingUp, 
    Search,
    Pause,
    PlayCircle
} from 'lucide-react';
import { 
    Layout, 
    Card, 
    Row, 
    Col, 
    Statistic, 
    Button, 
    Space, 
    Table, 
    Input, 
    Badge, 
    Alert, 
    Tag, 
    Progress, 
    Skeleton, 
    Typography, 
    Popconfirm,
    Tooltip,
    Divider
} from 'antd';
import { scheduledRunsApi, settingsApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;

// Premium Skeleton Loaders Powered by Ant Design Animations
const RunListSkeleton = () => (
    <div style={{ padding: '16px', animation: 'fadeIn 0.3s ease-out' }}>
        <Skeleton active paragraph={{ rows: 10 }} title={false} />
    </div>
);

const SellerTableSkeleton = () => (
    <div style={{ padding: '24px', animation: 'fadeIn 0.3s ease-out' }}>
        <div className="mb-4">
            <Skeleton.Button active size="large" style={{ width: 300 }} />
        </div>
        <Skeleton active paragraph={{ rows: 8 }} />
    </div>
);

const ScheduledRunsPage = () => {
    const [runs, setRuns] = useState([]);
    const [selectedRun, setSelectedRun] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [triggering, setTriggering] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState(null);
    const [scheduleConfig, setScheduleConfig] = useState({ scheduleTime: '11:20', ajioScheduleTime: '12:00', automationEnabled: false });

    // Premium UI states
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [secondsToRefresh, setSecondsToRefresh] = useState(15);
    const [isAutoSyncPaused, setIsAutoSyncPaused] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

    // Fetch all runs
    const fetchRuns = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await scheduledRunsApi.getAll();
            if (res.success) {
                const fetchedRuns = res.data || [];
                setRuns(fetchedRuns);
                setLastUpdated(new Date().toLocaleTimeString());
                
                // Auto-select latest run on load
                if (fetchedRuns.length > 0 && !selectedRun) {
                    handleViewDetails(fetchedRuns[0].Id, silent);
                } else if (selectedRun) {
                    // Silent refresh details for selected run if it's currently running
                    const updatedRun = fetchedRuns.find(r => r.Id === selectedRun.Id);
                    if (updatedRun && (updatedRun.Status === 'RUNNING' || silent)) {
                        handleViewDetails(selectedRun.Id, true);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch scheduled runs:', err);
            setMessage({ type: 'danger', text: err.message || 'Failed to fetch scheduled runs' });
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchRuns();
        // Fetch schedule config from env via backend
        settingsApi.getScheduleConfig()
            .then(res => { if (res.success) setScheduleConfig(res.data); })
            .catch(() => {}); // fallback stays '00:00'
    }, []);

    // Countdown and dynamic auto-refresh engine
    useEffect(() => {
        const hasActiveRun = runs.some(r => r.Status === 'RUNNING');
        const defaultInterval = hasActiveRun ? 5 : 15;

        if (secondsToRefresh > defaultInterval) {
            setSecondsToRefresh(defaultInterval);
        }

        const timer = setInterval(() => {
            if (isAutoSyncPaused) return;

            setSecondsToRefresh(prev => {
                if (prev <= 1) {
                    fetchRuns(true);
                    return defaultInterval;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [runs, isAutoSyncPaused, selectedRun]);

    // Fetch details for a specific run
    const handleViewDetails = async (id, silent = false) => {
        if (!silent) setDetailsLoading(true);
        try {
            const res = await scheduledRunsApi.getDetails(id);
            if (res.success) {
                setSelectedRun(res.data);
            }
        } catch (err) {
            console.error('Failed to fetch run details:', err);
            setMessage({ type: 'danger', text: err.message || 'Failed to fetch run details' });
        } finally {
            if (!silent) setDetailsLoading(false);
        }
    };

    // Trigger a manual run
    const handleManualTrigger = async () => {
        setTriggering(true);
        setMessage(null);
        try {
            const res = await scheduledRunsApi.trigger();
            if (res.success) {
                setMessage({ 
                    type: 'success', 
                    text: res.message || 'Nightly pipeline manually triggered successfully in the background.' 
                });
                setTimeout(() => fetchRuns(), 1500);
            }
        } catch (err) {
            console.error('Failed to trigger run:', err);
            setMessage({ type: 'danger', text: err.message || 'Failed to trigger enterprise pipeline' });
        } finally {
            setTriggering(false);
        }
    };

    // Metrics extraction
    const totalRunsCount = runs.length;
    const completedRunsCount = runs.filter(r => r.Status === 'COMPLETED').length;
    const runningRunsCount = runs.filter(r => r.Status === 'RUNNING').length;
    const failedRunsCount = runs.filter(r => r.Status === 'FAILED').length;
    const successRate = totalRunsCount > 0 ? Math.round((completedRunsCount / totalRunsCount) * 100) : 100;

    // Helpers
    const formatDuration = (start, end) => {
        if (!start) return '-';
        const startTime = new Date(start).getTime();
        const endTime = end ? new Date(end).getTime() : Date.now();
        const diffMs = endTime - startTime;
        
        const secs = Math.floor(diffMs / 1000);
        if (secs < 60) return `${secs}s`;
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        return `${mins}m ${remSecs}s`;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const filteredRuns = runs.filter(run => {
        const matchesStatus = statusFilter === 'ALL' || run.Status === statusFilter;
        if (!matchesStatus) return false;
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            run.Id.toLowerCase().includes(term) ||
            run.Status.toLowerCase().includes(term) ||
            (run.StartTime && formatDate(run.StartTime).toLowerCase().includes(term))
        );
    });

    // Ant Design Table Column Schema for Seller breakdowns
    const sellerTableColumns = [
        {
            title: 'Seller Name',
            dataIndex: 'name',
            key: 'name',
            render: (text) => <Text strong style={{ color: '#334155' }}>{text}</Text>
        },
        {
            title: 'Injected ASINs',
            dataIndex: 'asinsCount',
            key: 'asinsCount',
            align: 'center',
            render: (val) => <Tag color="blue" style={{ fontWeight: 700, borderRadius: '4px' }}>{val || 0}</Tag>
        },
        {
            title: 'Ingested Records',
            key: 'count',
            render: (_, record) => {
                const progressPercent = record.asinsCount > 0 ? Math.min(Math.round((record.count / record.asinsCount) * 100), 100) : 0;
                const isRunning = record.status === 'RUNNING';
                return (
                    <div style={{ minWidth: '140px' }}>
                        <div className="d-flex justify-content-between align-items-center mb-1.5">
                            <Text strong style={{ color: record.count > 0 ? '#059669' : '#64748b', fontSize: '13px' }}>{record.count || 0}</Text>
                            {record.asinsCount > 0 && <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{progressPercent}%</span>}
                        </div>
                        {record.asinsCount > 0 && (
                            <Progress 
                                percent={progressPercent} 
                                size="small" 
                                status={isRunning ? 'active' : record.status === 'FAILED' ? 'exception' : 'success'}
                                strokeColor={isRunning ? '#f59e0b' : undefined}
                                showInfo={false}
                                style={{ margin: 0 }}
                            />
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Time Log',
            key: 'timeLog',
            render: (_, record) => (
                <div>
                    <Space size={4}>⏱️ <Text style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>{formatDuration(record.startTime, record.endTime)}</Text></Space>
                    {record.startTime && (
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                            {new Date(record.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                if (status === 'RUNNING') return <Tag icon={<Loader2 size={12} className="spin" />} color="warning" style={{ borderRadius: '12px', fontWeight: 600 }}>RUNNING</Tag>;
                if (status === 'COMPLETED') return <Tag icon={<CheckCircle2 size={12} />} color="success" style={{ borderRadius: '12px', fontWeight: 600 }}>COMPLETED</Tag>;
                if (status === 'FAILED') return <Tag icon={<XCircle size={12} />} color="error" style={{ borderRadius: '12px', fontWeight: 600 }}>FAILED</Tag>;
                return <Tag>{status}</Tag>;
            }
        }
    ];

    return (
        <div className="scheduled-page-container">
            
            {/* Modern High-Tech Visual Style Block */}
            <style>{`
                .scheduled-page-container {
                    display: flex;
                    flex-direction: column;
                    height: calc(100vh - 60px);
                    overflow: hidden;
                    background-color: #f8fafc;
                    margin: -1.5rem -2rem;
                }
                .scheduled-header {
                    flex-shrink: 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 24px;
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    color: #fff;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                    z-index: 10;
                }
                .scheduled-stats-section {
                    flex-shrink: 0;
                    padding: 16px 24px 8px 24px;
                }
                .scheduled-main-content {
                    flex: 1;
                    overflow: hidden;
                    padding: 0 24px 16px 24px;
                    display: flex;
                    gap: 16px;
                }
                .scheduled-left-pane {
                    width: 400px;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }
                .scheduled-right-pane {
                    flex: 1;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }
                .flex-card-body {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }
                .scroll-list-container {
                    flex: 1;
                    overflow-y: auto;
                }
                
                /* Live animation engine */
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .fade-in-element {
                    animation: fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
                .spin { animation: spin 1.2s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse-green {
                    0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                    50% { opacity: 0.6; transform: scale(1.15); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
                }

                /* KPI Cards Enhancement */
                .metric-card {
                    cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 2px solid #e2e8f0 !important;
                    border-radius: 12px !important;
                    overflow: hidden;
                }
                .metric-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 8px 16px -4px rgba(15, 23, 42, 0.08) !important;
                }
                .metric-card.active-filter-ALL {
                    border-color: #3b82f6 !important;
                    background: linear-gradient(145deg, #ffffff 0%, #eff6ff 100%) !important;
                }
                .metric-card.active-filter-RUNNING {
                    border-color: #f59e0b !important;
                    background: linear-gradient(145deg, #ffffff 0%, #fffbeb 100%) !important;
                }
                .metric-card.active-filter-COMPLETED {
                    border-color: #10b981 !important;
                    background: linear-gradient(145deg, #ffffff 0%, #ecfdf5 100%) !important;
                }
                .metric-card.active-filter-FAILED {
                    border-color: #ef4444 !important;
                    background: linear-gradient(145deg, #ffffff 0%, #fff1f2 100%) !important;
                }

                .run-list-item {
                    cursor: pointer;
                    border-bottom: 1px solid #f1f5f9;
                    transition: all 0.2s ease;
                    border-left: 4px solid transparent;
                    padding: 14px 18px;
                }
                .run-list-item:hover {
                    background-color: #f8fafc;
                }
                .run-list-item.active {
                    background-color: #eff6ff;
                    border-left-color: #3b82f6;
                }
                .run-list-item.active:hover {
                    background-color: #eff6ff;
                }

                /* Ant Design overrides for total space utilization */
                .scheduled-ant-card {
                    border-radius: 12px !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.02) !important;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }
                .scheduled-ant-card > .ant-card-body {
                    flex: 1;
                    overflow: hidden;
                    padding: 0 !important;
                    display: flex;
                    flex-direction: column;
                }
                
                /* Custom system scrollbar */
                .scroll-list-container::-webkit-scrollbar { width: 6px; }
                .scroll-list-container::-webkit-scrollbar-track { background: transparent; }
                .scroll-list-container::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .scroll-list-container::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

                @media (max-width: 992px) {
                    .scheduled-page-container {
                        margin: -0.75rem;
                        height: auto;
                        overflow: visible;
                    }
                    .scheduled-header {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 16px;
                    }
                    .scheduled-main-content {
                        flex-direction: column;
                        overflow: visible;
                        height: auto;
                        gap: 24px;
                    }
                    .scheduled-left-pane, .scheduled-right-pane {
                        width: 100%;
                        height: auto;
                    }
                    .scroll-list-container {
                        max-height: 400px;
                    }
                    .scheduled-ant-card {
                        height: auto;
                    }
                }
            `}</style>

            {/* HEADER BAR (DARK GRADIENT BANNER) */}
            <div className="scheduled-header">
                <div className="d-flex flex-column gap-1">
                    <div className="d-flex align-items-center gap-3 flex-wrap">
                        <div className="bg-primary bg-opacity-20 p-2 rounded-3" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                            <Clock size={22} style={{ color: '#60a5fa' }} />
                        </div>
                        <div>
                            <Title level={4} style={{ margin: 0, color: '#fff', fontWeight: 800, letterSpacing: '-0.02em' }}>Scheduled Runs & Ingestion Telemetry</Title>
                            <Paragraph style={{ margin: 0, color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>
                                Amazon Pipeline at <Text strong style={{ color: '#93c5fd' }}>{scheduleConfig.scheduleTime || '11:20'}</Text> • Ajio Pipeline at <Text strong style={{ color: '#a7f3d0' }}>{scheduleConfig.ajioScheduleTime || '12:00'}</Text>
                            </Paragraph>
                        </div>

                        {/* Live countdown engine status */}
                        <div className="d-flex align-items-center gap-2 px-3 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 ms-md-2" style={{ fontSize: '11px', fontWeight: '600', borderRadius: '20px' }}>
                            <span 
                                className="d-inline-block rounded-circle" 
                                style={{ 
                                    width: '7px', 
                                    height: '7px', 
                                    backgroundColor: isAutoSyncPaused ? '#f59e0b' : '#10b981', 
                                    animation: isAutoSyncPaused ? 'none' : 'pulse-green 1.8s infinite ease-in-out' 
                                }} 
                            />
                            <span>{isAutoSyncPaused ? 'Auto-Sync Paused' : `Live Sync: ${secondsToRefresh}s`}</span>
                        </div>
                    </div>
                </div>

                {/* Control Actions Cluster */}
                <div className="d-flex align-items-center gap-2 flex-wrap">
                    <Button 
                        onClick={() => setIsAutoSyncPaused(!isAutoSyncPaused)}
                        icon={isAutoSyncPaused ? <PlayCircle size={14} /> : <Pause size={14} />}
                        style={{ 
                            backgroundColor: isAutoSyncPaused ? '#d97706' : '#334155', 
                            border: 'none', 
                            color: '#fff', 
                            fontSize: '12px', 
                            fontWeight: 600,
                            borderRadius: '6px'
                        }}
                    >
                        {isAutoSyncPaused ? 'Resume Auto-Sync' : 'Pause'}
                    </Button>

                    <Button 
                        onClick={() => fetchRuns()}
                        icon={<RefreshCw size={13} className={loading ? 'spin' : ''} />}
                        disabled={loading}
                        ghost
                        style={{ 
                            borderColor: 'rgba(255,255,255,0.2)', 
                            color: '#fff', 
                            fontSize: '12px',
                            borderRadius: '6px'
                        }}
                    >
                        Refresh
                    </Button>

                    <Popconfirm
                        title="Trigger Manual Nightly Pipeline"
                        description={
                            <div style={{ maxWidth: 300 }}>
                                Are you sure you want to stop all active tasks, clear exported data, and trigger the enterprise pipeline?
                                <div className="mt-1.5 text-zinc-400 small">This will process exactly 5 active sellers concurrently.</div>
                            </div>
                        }
                        okText="Yes, Trigger Pipeline"
                        cancelText="Cancel"
                        onConfirm={handleManualTrigger}
                        okButtonProps={{ danger: false, style: { backgroundColor: '#10b981', borderColor: '#10b981' } }}
                    >
                        <Button 
                            type="primary"
                            icon={triggering ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
                            disabled={triggering || runningRunsCount > 0}
                            style={{ 
                                backgroundColor: '#10b981', 
                                borderColor: '#10b981', 
                                color: '#fff', 
                                fontWeight: 700, 
                                fontSize: '12px',
                                borderRadius: '6px'
                            }}
                        >
                            Manual Trigger
                        </Button>
                    </Popconfirm>
                </div>
            </div>

            {/* MESSAGES BANNER */}
            {message && (
                <div style={{ padding: '16px 24px 0 24px' }}>
                    <Alert
                        title={message.text}
                        type={message.type === 'success' ? 'success' : 'error'}
                        showIcon
                        closable
                        onClose={() => setMessage(null)}
                        style={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}
                    />
                </div>
            )}

            {/* KPI METRICS BOARD */}
            <div className="scheduled-stats-section">
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={6}>
                        <Card 
                            className={`metric-card ${statusFilter === 'ALL' ? 'active-filter-ALL' : ''}`} 
                            onClick={() => setStatusFilter('ALL')}
                            styles={{ body: { padding: 16 } }}
                        >
                            <Statistic
                                title={<Text strong style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Total Ingestion Cycles</Text>}
                                value={totalRunsCount}
                                prefix={<Calendar size={16} style={{ color: '#3b82f6', marginRight: 6, verticalAlign: 'middle' }} />}
                                styles={{ content: { fontWeight: 800, fontSize: '26px', color: '#1e293b', letterSpacing: '-0.03em' } }}
                            />
                            <div style={{ marginTop: 6 }}><Text style={{ fontSize: '11px', color: '#94a3b8' }}>Click to filter all historical logs</Text></div>
                        </Card>
                    </Col>
                    
                    <Col xs={24} sm={12} md={6}>
                        <Card 
                            className={`metric-card ${statusFilter === 'RUNNING' ? 'active-filter-RUNNING' : ''}`} 
                            onClick={() => setStatusFilter('RUNNING')}
                            styles={{ body: { padding: 16 } }}
                        >
                            <Statistic
                                title={<Text strong style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Active Pipelines Now</Text>}
                                value={runningRunsCount}
                                prefix={<Loader2 size={16} className={runningRunsCount > 0 ? 'spin' : ''} style={{ color: '#f59e0b', marginRight: 6, verticalAlign: 'middle' }} />}
                                styles={{ content: { fontWeight: 800, fontSize: '26px', color: '#1e293b', letterSpacing: '-0.03em' } }}
                            />
                            <div style={{ marginTop: 6 }}><Text style={{ fontSize: '11px', color: '#94a3b8' }}>Click to filter currently running</Text></div>
                        </Card>
                    </Col>

                    <Col xs={24} sm={12} md={6}>
                        <Card 
                            className={`metric-card ${statusFilter === 'COMPLETED' ? 'active-filter-COMPLETED' : ''}`} 
                            onClick={() => setStatusFilter('COMPLETED')}
                            styles={{ body: { padding: 16 } }}
                        >
                            <Statistic
                                title={<Text strong style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Execution Success Rate</Text>}
                                value={successRate}
                                suffix="%"
                                prefix={<TrendingUp size={16} style={{ color: '#10b981', marginRight: 6, verticalAlign: 'middle' }} />}
                                styles={{ content: { fontWeight: 800, fontSize: '26px', color: '#1e293b', letterSpacing: '-0.03em' } }}
                            />
                            <div style={{ marginTop: 6 }}><Text style={{ fontSize: '11px', color: '#94a3b8' }}>Click to filter completed cycles</Text></div>
                        </Card>
                    </Col>

                    <Col xs={24} sm={12} md={6}>
                        <Card 
                            className={`metric-card ${statusFilter === 'FAILED' ? 'active-filter-FAILED' : ''}`} 
                            onClick={() => setStatusFilter('FAILED')}
                            styles={{ body: { padding: 16 } }}
                        >
                            <Statistic
                                title={<Text strong style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Failed Operations</Text>}
                                value={failedRunsCount}
                                prefix={<XCircle size={16} style={{ color: '#ef4444', marginRight: 6, verticalAlign: 'middle' }} />}
                                styles={{ content: { fontWeight: 800, fontSize: '26px', color: '#1e293b', letterSpacing: '-0.03em' } }}
                            />
                            <div style={{ marginTop: 6 }}><Text style={{ fontSize: '11px', color: '#94a3b8' }}>Click to filter failed pipelines</Text></div>
                        </Card>
                    </Col>
                </Row>
            </div>

            {/* MAIN CONTENT SPLIT LAYOUT (HEIGHT: 100%) */}
            <div className="scheduled-main-content">
                
                {/* LEFT PANE: LIST OF RUNS */}
                <div className="scheduled-left-pane fade-in-element">
                    <Card 
                        className="scheduled-ant-card"
                        title={
                            <Space align="center">
                                <Text strong style={{ color: '#1e293b', fontSize: '14px' }}>Execution History Log</Text>
                                {statusFilter !== 'ALL' && (
                                    <Tag 
                                        closable 
                                        onClose={() => setStatusFilter('ALL')}
                                        color={statusFilter === 'RUNNING' ? 'orange' : statusFilter === 'COMPLETED' ? 'green' : 'red'}
                                        style={{ fontWeight: 700, fontSize: '10px', margin: 0 }}
                                    >
                                        {statusFilter}
                                    </Tag>
                                )}
                            </Space>
                        }
                        extra={
                            <Input 
                                placeholder="Search history..." 
                                prefix={<Search size={13} style={{ color: '#94a3b8' }} />} 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ width: 160, borderRadius: '6px' }}
                                size="small"
                                allowClear
                            />
                        }
                    >
                        {loading ? (
                            <RunListSkeleton />
                        ) : filteredRuns.length === 0 ? (
                            <div className="d-flex flex-column align-items-center justify-content-center h-100" style={{ padding: '48px 0', color: '#94a3b8' }}>
                                <Clock size={32} style={{ color: '#cbd5e1', marginBottom: 8 }} />
                                <span style={{ fontSize: '13px' }}>No runs match the criteria.</span>
                            </div>
                        ) : (
                            <div className="scroll-list-container">
                                {filteredRuns.map((run) => {
                                    const isSelected = selectedRun && selectedRun.Id === run.Id;
                                    return (
                                        <div 
                                            key={run.Id}
                                            onClick={() => handleViewDetails(run.Id)}
                                            className={`run-list-item ${isSelected ? 'active' : ''}`}
                                        >
                                            <div className="d-flex justify-content-between align-items-center gap-2">
                                                <div className="flex-grow-1">
                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                        <Text strong style={{ fontSize: '13px', color: '#334155' }}>
                                                            Run #{run.Id.substring(0, 8)}
                                                        </Text>
                                                        {run.Status === 'RUNNING' && <Tag color="warning" style={{ fontSize: '9px', padding: '0 4px', borderRadius: '2px', fontWeight: 700 }}>RUNNING</Tag>}
                                                        {run.Status === 'COMPLETED' && <Tag color="success" style={{ fontSize: '9px', padding: '0 4px', borderRadius: '2px', fontWeight: 700 }}>COMPLETED</Tag>}
                                                        {run.Status === 'FAILED' && <Tag color="error" style={{ fontSize: '9px', padding: '0 4px', borderRadius: '2px', fontWeight: 700 }}>FAILED</Tag>}
                                                    </div>
                                                    <div className="text-zinc-500 d-flex flex-column gap-0.5" style={{ fontSize: '11px', color: '#64748b' }}>
                                                        <span>📅 Start: {formatDate(run.StartTime)}</span>
                                                        <span>⏱️ Duration: {formatDuration(run.StartTime, run.EndTime)}</span>
                                                    </div>
                                                </div>
                                                <ChevronRight size={16} style={{ color: isSelected ? '#3b82f6' : '#cbd5e1', transition: 'color 0.2s' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        
                        {/* Static Footer Inside Card */}
                        <div className="bg-light border-top d-flex justify-content-between align-items-center" style={{ padding: '10px 16px', flexShrink: 0, backgroundColor: '#f8fafc' }}>
                            <Text type="secondary" style={{ fontSize: '10px', fontWeight: 500 }}>Last Update: {lastUpdated}</Text>
                            <Text type="secondary" style={{ fontSize: '10px', fontWeight: 600 }}>Filtered: {filteredRuns.length}</Text>
                        </div>
                    </Card>
                </div>

                {/* RIGHT PANE: TELEMETRY LOG TABLE */}
                <div className="scheduled-right-pane fade-in-element">
                    <Card 
                        className="scheduled-ant-card"
                        title={
                            <Space>
                                <Database size={15} style={{ color: '#3b82f6' }} />
                                <Text strong style={{ color: '#1e293b', fontSize: '14px' }}>Seller Sync Breakdown & Metrics</Text>
                            </Space>
                        }
                        extra={
                            selectedRun && (
                                <Tag color="blue" style={{ border: 'none', fontWeight: 700, backgroundColor: '#eff6ff', color: '#2563eb' }}>
                                    ID: {selectedRun.Id}
                                </Tag>
                            )
                        }
                    >
                        {detailsLoading ? (
                            <SellerTableSkeleton />
                        ) : !selectedRun ? (
                            <div className="d-flex flex-column align-items-center justify-content-center h-100" style={{ padding: '64px 0', color: '#94a3b8' }}>
                                <FileText size={44} style={{ color: '#cbd5e1', marginBottom: 12 }} />
                                <Text type="secondary" style={{ fontSize: '13px' }}>Select a historical cycle from the list to review details.</Text>
                            </div>
                        ) : (
                            <div className="scroll-list-container" style={{ padding: '20px' }}>
                                
                                {/* Vibrant Status Banner */}
                                <div className="mb-4 p-3 rounded-3 text-white shadow-sm d-flex justify-content-between align-items-center flex-wrap gap-2" 
                                     style={{ background: selectedRun.Status === 'RUNNING' ? 'linear-gradient(90deg, #d97706 0%, #b45309 100%)' : selectedRun.Status === 'COMPLETED' ? 'linear-gradient(90deg, #059669 0%, #047857 100%)' : 'linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)' }}>
                                    <div className="d-flex align-items-center gap-2">
                                        {selectedRun.Status === 'RUNNING' && <Loader2 size={16} className="spin" />}
                                        {selectedRun.Status === 'COMPLETED' && <CheckCircle2 size={16} />}
                                        {selectedRun.Status === 'FAILED' && <XCircle size={16} />}
                                        <Text strong style={{ fontSize: '13px', color: '#fff' }}>Pipeline Execution Status: {selectedRun.Status}</Text>
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 600 }}>
                                        Total Process Duration: {formatDuration(selectedRun.StartTime, selectedRun.EndTime)}
                                    </div>
                                </div>

                                {/* Ant Design Premium Table Rendering */}
                                <div className="border rounded-3" style={{ overflow: 'hidden', borderColor: '#f1f5f9' }}>
                                    <Table 
                                        columns={sellerTableColumns}
                                        dataSource={selectedRun.Details || []}
                                        rowKey={(record, index) => index}
                                        pagination={false}
                                        size="middle"
                                        scroll={{ x: 'max-content' }}
                                        locale={{
                                            emptyText: <div style={{ padding: '24px' }}><Text type="secondary">No seller statistics recorded for this operation.</Text></div>
                                        }}
                                        expandable={{
                                            expandedRowRender: (record) => record.error ? (
                                                <div style={{ background: '#fef2f2', padding: '12px 16px', borderRadius: 6, color: '#dc2626', fontSize: '12px', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                                                    <div>
                                                        <strong style={{ display: 'block', marginBottom: '2px' }}>Sync Operation Failure</strong>
                                                        <span style={{ color: '#7f1d1d' }}>{record.error}</span>
                                                    </div>
                                                </div>
                                            ) : null,
                                            rowExpandable: (record) => !!record.error,
                                            defaultExpandAllRows: true
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </Card>
                </div>

            </div>

        </div>
    );
};

export default ScheduledRunsPage;
