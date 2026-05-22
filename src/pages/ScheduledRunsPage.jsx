import React, { useState, useEffect, useMemo } from 'react';
import { 
    Clock, 
    PlayCircle, 
    RefreshCw, 
    CheckCircle2, 
    XCircle, 
    Loader2, 
    Database, 
    AlertCircle, 
    TrendingUp, 
    Search,
    ChevronDown,
    List
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
    Tag, 
    Progress, 
    Typography, 
    Dropdown,
    Modal,
    Alert,
    Tooltip,
    Drawer,
    Timeline
} from 'antd';
import { scheduledRunsApi, settingsApi } from '../services/api';
import { formatDistanceToNow } from 'date-fns';

const { Title, Text, Paragraph } = Typography;

const ScheduledRunsPage = () => {
    const [metrics, setMetrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [triggering, setTriggering] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState(null);
    const [scheduleConfig, setScheduleConfig] = useState({ scheduleTime: '11:20', ajioScheduleTime: '12:00', automationEnabled: false });

    // Drawer state
    const [logsDrawerVisible, setLogsDrawerVisible] = useState(false);
    const [selectedSeller, setSelectedSeller] = useState(null);
    const [sellerLogs, setSellerLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);

    // Fetch seller metrics
    const fetchMetrics = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await scheduledRunsApi.getSellerMetrics();
            if (res.success) {
                setMetrics(res.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch seller metrics:', err);
            setMessage({ type: 'error', text: err.message || 'Failed to fetch seller telemetry metrics' });
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
        settingsApi.getScheduleConfig()
            .then(res => { if (res.success) setScheduleConfig(res.data); })
            .catch(() => {});
    }, []);

    // Fetch individual seller logs
    const handleViewLogs = async (seller) => {
        setSelectedSeller(seller);
        setLogsDrawerVisible(true);
        setLogsLoading(true);
        try {
            const res = await scheduledRunsApi.getSellerLogs(seller.sellerId);
            if (res.success) {
                setSellerLogs(res.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch seller logs:', err);
        } finally {
            setLogsLoading(false);
        }
    };

    // Manual run
    const handleManualTrigger = async (marketplace = 'amazon') => {
        setTriggering(true);
        setMessage(null);
        try {
            const res = await scheduledRunsApi.trigger(marketplace);
            if (res.success) {
                setMessage({ 
                    type: 'success', 
                    text: res.message || `${marketplace.toUpperCase()} pipeline manually triggered successfully.` 
                });
                setTimeout(() => fetchMetrics(true), 3000); // Check for running tasks slightly later
            }
        } catch (err) {
            console.error(`Failed to trigger ${marketplace} run:`, err);
            setMessage({ type: 'error', text: err.message || `Failed to trigger ${marketplace.toUpperCase()} pipeline` });
        } finally {
            setTriggering(false);
        }
    };

    // Calculate Global KPIs from seller metrics
    const globalStats = useMemo(() => {
        let totalActive = 0;
        let totalCompleted = 0;
        let totalFailed = 0;
        let globalInserted = 0;
        let globalExpected = 0;
        
        metrics.forEach(m => {
            globalInserted += (m.totalInserted || 0);
            globalExpected += (m.totalExpected || 0);
            totalActive += m.runningRuns;
            totalCompleted += m.completedRuns;
            totalFailed += m.failedRuns;
        });

        const totalHistoricalRuns = totalActive + totalCompleted + totalFailed;
        const globalSuccessRate = totalHistoricalRuns > 0 ? Math.round((totalCompleted / totalHistoricalRuns) * 100) : 100;
        const globalIngestProgress = globalExpected > 0 ? Math.min(Math.round((globalInserted / globalExpected) * 100), 100) : 0;

        return { totalActive, globalInserted, globalExpected, globalSuccessRate, globalIngestProgress };
    }, [metrics]);

    const filteredMetrics = metrics.filter(m => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (m.name || '').toLowerCase().includes(term);
    });

    const columns = [
        {
            title: 'Seller Account',
            dataIndex: 'name',
            key: 'name',
            render: (text) => <Text strong style={{ color: '#1e293b', fontSize: 14 }}>{text}</Text>,
            sorter: (a, b) => (a.name || '').localeCompare(b.name || '')
        },
        {
            title: 'Total Task Runs',
            dataIndex: 'totalRuns',
            key: 'totalRuns',
            align: 'center',
            render: (val) => <Tag color="blue" style={{ fontWeight: 600, fontSize: 13, borderRadius: '4px', padding: '2px 10px' }}>{val}</Tag>,
            sorter: (a, b) => a.totalRuns - b.totalRuns
        },
        {
            title: 'Data Ingestion Progress (All Time)',
            key: 'dataIngested',
            width: 250,
            render: (_, record) => {
                const pct = record.totalExpected > 0 ? Math.min(Math.round((record.totalInserted / record.totalExpected) * 100), 100) : 0;
                return (
                    <div style={{ width: '100%' }}>
                        <div className="d-flex justify-content-between mb-1">
                            <Text strong style={{ color: '#059669', fontSize: 12 }}>{record.totalInserted.toLocaleString()} inserted</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>{record.totalExpected.toLocaleString()} expected</Text>
                        </div>
                        <Progress 
                            percent={pct} 
                            size="small" 
                            status={record.runningRuns > 0 ? 'active' : (pct === 100 ? 'success' : 'normal')}
                            strokeColor={{ '0%': '#10b981', '100%': '#34d399' }}
                            showInfo={false}
                        />
                    </div>
                );
            },
            sorter: (a, b) => a.totalInserted - b.totalInserted
        },
        {
            title: 'Success Rate',
            key: 'successRate',
            align: 'center',
            render: (_, record) => {
                const totalFinished = record.completedRuns + record.failedRuns;
                const rate = totalFinished > 0 ? Math.round((record.completedRuns / totalFinished) * 100) : 100;
                return (
                    <Tooltip title={`${record.completedRuns} successful out of ${totalFinished} finished runs`}>
                        <Progress type="dashboard" size={40} percent={rate} gapDegree={100} strokeWidth={12} 
                            strokeColor={rate >= 90 ? '#10b981' : rate >= 70 ? '#f59e0b' : '#ef4444'} 
                            format={() => <span style={{ fontSize: 10, fontWeight: 700 }}>{rate}%</span>} 
                        />
                    </Tooltip>
                );
            },
            sorter: (a, b) => {
                const rA = (a.completedRuns + a.failedRuns) > 0 ? a.completedRuns / (a.completedRuns + a.failedRuns) : 1;
                const rB = (b.completedRuns + b.failedRuns) > 0 ? b.completedRuns / (b.completedRuns + b.failedRuns) : 1;
                return rA - rB;
            }
        },
        {
            title: 'Latest Run Status',
            key: 'lastRun',
            render: (_, record) => {
                if (!record.lastRunDate) return <Text type="secondary">Never Run</Text>;
                const isRunning = record.lastRunStatus === 'RUNNING';
                return (
                    <div>
                        <Tag 
                            color={isRunning ? 'processing' : record.lastRunStatus === 'COMPLETED' ? 'success' : 'error'}
                            icon={isRunning ? <Loader2 size={12} className="spin mr-1" /> : undefined}
                            style={{ fontWeight: 700, borderRadius: 12 }}
                        >
                            {record.lastRunStatus}
                        </Tag>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                            {formatDistanceToNow(new Date(record.lastRunDate), { addSuffix: true })}
                        </div>
                    </div>
                );
            },
            sorter: (a, b) => new Date(a.lastRunDate || 0) - new Date(b.lastRunDate || 0)
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'center',
            render: (_, record) => (
                <Button 
                    type="primary" 
                    ghost 
                    size="small" 
                    icon={<List size={14} />} 
                    onClick={() => handleViewLogs(record)}
                    style={{ fontSize: 12, borderRadius: 6 }}
                >
                    View Logs
                </Button>
            )
        }
    ];

    const pipelineMenuItems = [
        {
            key: 'amazon',
            label: <Text strong>Run Amazon Pipeline</Text>,
            onClick: () => {
                Modal.confirm({
                    title: 'Launch Amazon Enterprise Pipeline?',
                    content: 'Triggers synchronous scraping and data cleaning for Amazon sellers.',
                    okText: 'Launch',
                    onOk: () => handleManualTrigger('amazon')
                });
            }
        },
        {
            key: 'ajio',
            label: <Text strong>Run Ajio Pipeline</Text>,
            onClick: () => {
                Modal.confirm({
                    title: 'Launch Ajio Enterprise Pipeline?',
                    content: 'Triggers synchronous scraping and data cleaning for Ajio sellers.',
                    okText: 'Launch',
                    onOk: () => handleManualTrigger('ajio')
                });
            }
        }
    ];

    return (
        <div style={{ backgroundColor: '#f8fafc', padding: 24, minHeight: 'calc(100vh - 60px)' }}>
            
            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                
                .ant-table-wrapper .ant-table-thead > tr > th {
                    background: #f1f5f9;
                    color: #475569;
                    font-weight: 700;
                    border-bottom: 2px solid #e2e8f0;
                }
                .ant-card {
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                }
                .ant-statistic-title {
                    font-weight: 700 !important;
                    color: #64748b !important;
                    font-size: 13px !important;
                }
                .ant-statistic-content {
                    font-weight: 800 !important;
                    color: #1e293b !important;
                }
            `}</style>

            <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
                <div>
                    <Title level={3} style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>
                        <Database size={24} className="mr-2" style={{ color: '#3b82f6', verticalAlign: 'middle' }}/> 
                        Scheduled Tasks & Telemetry
                    </Title>
                    <Paragraph style={{ margin: 0, color: '#64748b', fontWeight: 500 }}>
                        Review seller-level automation telemetry and ingestion history.
                    </Paragraph>
                </div>
                
                <Space size="middle">
                    <Button 
                        onClick={() => fetchMetrics()} 
                        icon={<RefreshCw size={14} className={loading ? 'spin' : ''} />}
                        style={{ fontWeight: 600 }}
                    >
                        Refresh Data
                    </Button>
                    <Dropdown menu={{ items: pipelineMenuItems }} trigger={['click']}>
                        <Button type="primary" icon={<PlayCircle size={14} />} style={{ fontWeight: 600, backgroundColor: '#10b981' }}>
                            Launch Pipeline <ChevronDown size={14} />
                        </Button>
                    </Dropdown>
                </Space>
            </div>

            {message && (
                <Alert
                    message={message.text}
                    type={message.type}
                    showIcon
                    closable
                    onClose={() => setMessage(null)}
                    style={{ marginBottom: 24, borderRadius: 8 }}
                />
            )}

            {/* KPIs */}
            <Row gutter={[24, 24]} className="mb-4">
                <Col xs={24} sm={12} md={6}>
                    <Card bodyStyle={{ padding: '20px 24px' }}>
                        <Statistic
                            title="TOTAL ACTIVE PIPELINES"
                            value={globalStats.totalActive}
                            prefix={<Loader2 size={18} className={globalStats.totalActive > 0 ? "spin mr-2" : "mr-2"} style={{ color: '#f59e0b' }} />}
                            valueStyle={{ color: globalStats.totalActive > 0 ? '#f59e0b' : '#1e293b' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card bodyStyle={{ padding: '20px 24px' }}>
                        <Statistic
                            title="GLOBAL INGESTION"
                            value={globalStats.globalInserted}
                            prefix={<Database size={18} className="mr-2" style={{ color: '#3b82f6' }} />}
                            formatter={val => val.toLocaleString()}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card bodyStyle={{ padding: '20px 24px' }}>
                        <Statistic
                            title="INGESTION YIELD (%)"
                            value={globalStats.globalIngestProgress}
                            suffix="%"
                            prefix={<TrendingUp size={18} className="mr-2" style={{ color: '#10b981' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card bodyStyle={{ padding: '20px 24px' }}>
                        <Statistic
                            title="GLOBAL SUCCESS RATE"
                            value={globalStats.globalSuccessRate}
                            suffix="%"
                            prefix={<CheckCircle2 size={18} className="mr-2" style={{ color: '#10b981' }} />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Seller Table */}
            <Card bodyStyle={{ padding: 0 }} bordered={false}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={5} style={{ margin: 0, fontWeight: 700, color: '#334155' }}>Seller Telemetry Breakdown</Title>
                    <Input 
                        placeholder="Search seller..." 
                        prefix={<Search size={14} style={{ color: '#94a3b8' }} />}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: 250, borderRadius: 6 }}
                        allowClear
                    />
                </div>
                <Table 
                    columns={columns} 
                    dataSource={filteredMetrics} 
                    rowKey="sellerId"
                    loading={loading}
                    pagination={{ 
                        defaultPageSize: 15,
                        showSizeChanger: true,
                        showTotal: (total) => `Total ${total} sellers`
                    }}
                />
            </Card>

            <Drawer
                title={
                    <div>
                        <Text strong style={{ fontSize: 16 }}>Task Logs</Text>
                        {selectedSeller && <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{selectedSeller.name}</div>}
                    </div>
                }
                placement="right"
                width={500}
                onClose={() => setLogsDrawerVisible(false)}
                open={logsDrawerVisible}
                styles={{ body: { padding: '24px', backgroundColor: '#f8fafc' } }}
            >
                {logsLoading ? (
                    <div className="d-flex justify-content-center align-items-center h-100">
                        <Loader2 size={32} className="spin" style={{ color: '#3b82f6' }} />
                    </div>
                ) : sellerLogs.length === 0 ? (
                    <Alert message="No execution logs found for this seller." type="info" showIcon />
                ) : (
                    <Timeline
                        items={sellerLogs.map((log) => {
                            const isRunning = log.status === 'RUNNING';
                            return {
                                color: isRunning ? 'orange' : log.status === 'COMPLETED' ? 'green' : 'red',
                                children: (
                                    <div className="bg-white p-3 border rounded shadow-sm mb-3">
                                        <div className="d-flex justify-content-between mb-2">
                                            <Tag color={isRunning ? 'processing' : log.status === 'COMPLETED' ? 'success' : 'error'} style={{ margin: 0, fontWeight: 700 }}>
                                                {log.status}
                                            </Tag>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {formatDistanceToNow(new Date(log.startTime || log.createdAt), { addSuffix: true })}
                                            </Text>
                                        </div>
                                        <div style={{ fontSize: 12, color: '#475569' }}>
                                            <div><strong>Run ID:</strong> {log.runId.substring(0, 8)}...</div>
                                            <div><strong>Started:</strong> {new Date(log.startTime || log.createdAt).toLocaleString()}</div>
                                            {log.endTime && <div><strong>Completed:</strong> {new Date(log.endTime).toLocaleString()}</div>}
                                            <div className="mt-2 pt-2 border-top">
                                                <Text strong style={{ color: '#059669' }}>{log.count || 0}</Text> records inserted out of <Text strong>{log.asinsCount || 0}</Text> expected.
                                            </div>
                                            {log.error && (
                                                <div className="mt-2 text-danger">
                                                    <strong>Error:</strong> {log.error}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            };
                        })}
                    />
                )}
            </Drawer>

        </div>
    );
};

export default ScheduledRunsPage;
