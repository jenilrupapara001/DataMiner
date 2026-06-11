import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { useSocket } from '../contexts/SocketContext';
import {
    Card, Table, Input, Select, Badge, Avatar, Space, Row, Col, Statistic, DatePicker,
    Typography, Button, Tag, Tooltip, Modal, Empty, Descriptions, message, Layout
} from 'antd';
import {
    Clock, Search, ArrowRight, CheckCircle, Calendar, Cpu, Database, Play,
    PlusCircle, Trash2, Edit3, ClipboardList, Activity, RefreshCw, ChevronRight,
    Info, Eye, Filter, User, HardDrive, Box, Shield, LogIn, LogOut, XCircle, AlertTriangle
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const ActivityLog = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [dateRange, setDateRange] = useState(null);
    const [selectedLog, setSelectedLog] = useState(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const socket = useSocket();

    useEffect(() => {
        loadLogs();
    }, []);

    // Real-time socket sync
    useEffect(() => {
        if (!socket) return;

        const handleNewSystemLog = (data) => {
            if (!data) return;
            const normalized = {
                ...data,
                _id: data._id || data.id || data.Id,
                createdAt: data.createdAt || data.CreatedAt,
                type: data.type || data.Type || '',
                entityType: data.entityType || data.EntityType || '',
                entityTitle: data.entityTitle || data.EntityTitle || '',
                description: data.description || data.Description || '',
                metadata: data.metadata || data.Metadata || null
            };
            setLogs(prev => [normalized, ...prev]);

            message.info({
                content: `Activity Stream: ${normalized.entityTitle || 'System Activity'} - ${normalized.description}`,
                icon: <Activity size={16} style={{ color: '#4f46e5' }} />,
                duration: 3
            });
        };

        socket.on('new_system_log', handleNewSystemLog);
        return () => socket.off('new_system_log', handleNewSystemLog);
    }, [socket]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await db.getSystemLogs();
            const normalized = (data || []).map(log => ({
                ...log,
                _id: log._id || log.id || log.Id,
                createdAt: log.createdAt || log.CreatedAt,
                type: log.type || log.Type || '',
                entityType: log.entityType || log.EntityType || '',
                entityTitle: log.entityTitle || log.EntityTitle || '',
                description: log.description || log.Description || '',
                metadata: log.metadata || log.Metadata || null
            }));
            setLogs(normalized);
        } catch (error) {
            console.error('Failed to load logs', error);
        } finally {
            setLoading(false);
        }
    };

    const getTypeStyle = (type = '') => {
        const t = type || '';
        switch (t) {
            case 'CREATE':
                return { icon: <PlusCircle size={14} />, color: '#10b981', label: 'Creation' };
            case 'UPDATE':
                return { icon: <Edit3 size={14} />, color: '#3b82f6', label: 'Update' };
            case 'DELETE':
                return { icon: <Trash2 size={14} />, color: '#ef4444', label: 'Deletion' };
            case 'STATUS_CHANGE':
                return { icon: <Activity size={14} />, color: '#f59e0b', label: 'Status' };
            case 'AUTH_SUCCESS':
                return { icon: <LogIn size={14} />, color: '#10b981', label: 'Login Success' };
            case 'AUTH_FAILURE':
                return { icon: <XCircle size={14} />, color: '#ef4444', label: 'Login Failure' };
            case 'AUTH_LOGOUT':
                return { icon: <LogOut size={14} />, color: '#64748b', label: 'Logout' };
            case 'SYSTEM_ERROR':
                return { icon: <AlertTriangle size={14} />, color: '#dc2626', label: 'Error' };
            case 'IMPORT':
                return { icon: <ClipboardList size={14} />, color: '#06b6d4', label: 'Import' };
            case 'AUTOMATION_TASK':
                return { icon: <Cpu size={14} />, color: '#6366f1', label: 'Automation Task' };
            case 'TARGET_UPDATE':
                return { icon: <Edit3 size={14} />, color: '#0284c7', label: 'Target Update' };
            case 'TARGET_IMPORT':
                return { icon: <ClipboardList size={14} />, color: '#0d9488', label: 'Target Import' };
            case 'TARGET_DELETE':
                return { icon: <Trash2 size={14} />, color: '#e11d48', label: 'Target Delete' };
            default:
                return { icon: <Info size={14} />, color: '#64748b', label: t.replace('_', ' ') || 'System' };
        }
    };

    const getEntityInfo = (type = '') => {
        const styles = {
            OBJECTIVE: { color: 'blue', icon: <Shield size={12} /> },
            KR: { color: 'cyan', icon: <Activity size={12} /> },
            ACTION: { color: 'orange', icon: <PlusCircle size={12} /> },
            SYSTEM: { color: 'default', icon: <HardDrive size={12} /> },
            USER: { color: 'purple', icon: <User size={12} /> },
            SERVER: { color: 'volcano', icon: <HardDrive size={12} /> },
            SELLER: { color: 'green', icon: <Box size={12} /> },
            ASIN: { color: 'geekblue', icon: <Box size={12} /> },
            MONTHLY_DATA: { color: 'magenta', icon: <ClipboardList size={12} /> }
        };
        return styles[type] || { color: 'default', icon: <Info size={12} /> };
    };

    const formatTime = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Calculate metrics summaries
    const metrics = useMemo(() => {
        const total = logs.length;
        const automations = logs.filter(l => l.type === 'AUTOMATION_TASK').length;
        const security = logs.filter(l => l.type?.startsWith('AUTH_')).length;
        const operations = logs.filter(l => ['CREATE', 'UPDATE', 'DELETE', 'TARGET_UPDATE', 'TARGET_DELETE', 'TARGET_IMPORT'].includes(l.type)).length;
        return { total, automations, security, operations };
    }, [logs]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch = searchQuery
                ? (log.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (log.entityTitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (log.user?.email || '').toLowerCase().includes(searchQuery.toLowerCase())
                : true;
            const matchesType = filterType === 'ALL' || log.type === filterType;

            const matchesDate = !dateRange || !dateRange[0] || !dateRange[1]
                ? true
                : (() => {
                    const logTime = new Date(log.createdAt).getTime();
                    const start = new Date(dateRange[0].toString()).setHours(0, 0, 0, 0);
                    const end = new Date(dateRange[1].toString()).setHours(23, 59, 59, 999);
                    return logTime >= start && logTime <= end;
                })();

            return matchesSearch && matchesType && matchesDate;
        });
    }, [logs, searchQuery, filterType, dateRange]);

    const showDetails = (log) => {
        setSelectedLog(log);
        setDetailModalVisible(true);
    };

    const renderMetadata = (metadata) => {
        if (!metadata) return <Text type="secondary">No technical data available.</Text>;

        let data = metadata;
        if (typeof metadata === 'string') {
            try { data = JSON.parse(metadata); } catch (e) { return <pre style={{ margin: 0, padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>{metadata}</pre>; }
        }

        if (typeof data !== 'object') return <pre style={{ margin: 0, padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>{JSON.stringify(data)}</pre>;

        return (
            <Descriptions bordered size="small" column={1} className="metadata-descriptions">
                {Object.entries(data).map(([key, value]) => (
                    <Descriptions.Item label={key.charAt(0).toUpperCase() + key.slice(1)} key={key}>
                        {typeof value === 'object' ? (
                            <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {JSON.stringify(value, null, 2)}
                            </pre>
                        ) : (
                            String(value)
                        )}
                    </Descriptions.Item>
                ))}
            </Descriptions>
        );
    };

    const columns = [
        {
            title: 'Timestamp',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 170,
            sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
            render: (val) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Space size={4} style={{ color: '#1e293b', fontWeight: 500, fontSize: '12px' }}>
                        <Clock size={12} style={{ color: '#64748b' }} />
                        <span>{new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </Space>
                    <Text type="secondary" style={{ fontSize: '10px', marginLeft: '16px' }}>
                        {new Date(val).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                </div>
            )
        },
        {
            title: 'Event',
            dataIndex: 'type',
            key: 'type',
            width: 160,
            render: (type) => {
                const conf = getTypeStyle(type);
                return (
                    <Tag
                        style={{
                            backgroundColor: `${conf.color}10`,
                            color: conf.color,
                            borderColor: `${conf.color}30`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            borderRadius: '20px',
                            padding: '3px 12px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            fontSize: '10px',
                            letterSpacing: '0.03em'
                        }}
                    >
                        {conf.icon}
                        {conf.label}
                    </Tag>
                );
            }
        },
        {
            title: 'Entity',
            dataIndex: 'entityType',
            key: 'entityType',
            width: 130,
            render: (type) => {
                const info = getEntityInfo(type);
                return (
                    <Tag
                        color={info.color}
                        style={{ borderRadius: '6px', fontSize: '10px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px' }}
                    >
                        {info.icon}
                        {type || 'SYSTEM'}
                    </Tag>
                );
            }
        },
        {
            title: 'Activity Description',
            key: 'activity',
            render: (_, record) => (
                <div onClick={() => showDetails(record)} style={{ cursor: 'pointer' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px', marginBottom: '2px' }}>
                        {record.entityTitle || 'System Activity'}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '12px', lineHeight: '1.4' }}>
                        {record.description || 'Action performed on the system.'}
                    </div>
                </div>
            )
        },
        {
            title: 'Initiated By',
            key: 'user',
            width: 190,
            render: (_, record) => {
                const name = record.user?.firstName ? `${record.user.firstName} ${record.user.lastName || ''}` : (record.user?.username || 'System');
                const email = record.user?.email || '';
                const initial = name.charAt(0).toUpperCase();
                const isSystem = name === 'System';
                return (
                    <Space size="middle">
                        <Avatar
                            size={28}
                            style={{
                                background: isSystem
                                    ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                                    : 'linear-gradient(135deg, #ec4899 0%, #d946ef 100%)',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: '11px'
                            }}
                        >
                            {initial}
                        </Avatar>
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                            <Text strong style={{ fontSize: '12px', color: '#1e293b' }}>{name}</Text>
                            {email && <Text type="secondary" style={{ fontSize: '10px' }}>{email}</Text>}
                        </div>
                    </Space>
                );
            }
        },
        {
            title: 'Action',
            key: 'actions',
            width: 70,
            align: 'center',
            render: (_, record) => (
                <Tooltip title="View Detailed Log">
                    <Button
                        type="text"
                        shape="circle"
                        icon={<Eye size={15} />}
                        onClick={() => showDetails(record)}
                        style={{ color: '#6366f1' }}
                    />
                </Tooltip>
            )
        }
    ];

    if (loading && logs.length === 0) {
        return <PageLoader message="Initializing Activity Streams..." />;
    }

    const clearAllFilters = () => {
        setSearchQuery('');
        setFilterType('ALL');
        setDateRange(null);
    };

    const hasActiveFilters = searchQuery !== '' || filterType !== 'ALL' || dateRange !== null;

    return (
        <div style={{ background: '#f8fafc', padding: '24px 32px', minHeight: 'calc(100vh - 72px)', overflowY: 'auto' }}>
            {/* HEADER AREA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ padding: '6px', background: '#e0e7ff', color: '#4f46e5', borderRadius: 8, display: 'flex' }}>
                            <Activity size={20} />
                        </div>
                        Activity Streams
                    </Title>
                    <Text style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginTop: 4 }}>
                        Real-time audit trail of all administrative and automated actions within the platform.
                    </Text>
                </div>

                <Button
                    type="primary"
                    onClick={loadLogs}
                    loading={loading}
                    icon={<RefreshCw size={14} />}
                    style={{ background: '#4f46e5', borderColor: '#4f46e5', fontWeight: 600, borderRadius: 8, height: '36px' }}
                >
                    Sync Streams
                </Button>
            </div>

            {/* METRICS ROW */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={12} md={6}>
                    <Card style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }} styles={{ body: { padding: '16px 20px' } }}>
                        <Statistic
                            title={<span style={{ color: '#64748b', fontSize: '12px', fontWeight: 600 }}>TOTAL STREAMS</span>}
                            value={metrics.total}
                            prefix={<Activity size={16} style={{ color: '#3b82f6', marginRight: 6, marginBottom: -2 }} />}
                            valueStyle={{ color: '#0f172a', fontWeight: 700, fontSize: '22px' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={12} md={6}>
                    <Card style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }} styles={{ body: { padding: '16px 20px' } }}>
                        <Statistic
                            title={<span style={{ color: '#64748b', fontSize: '12px', fontWeight: 600 }}>AUTOMATIONS</span>}
                            value={metrics.automations}
                            prefix={<Cpu size={16} style={{ color: '#8b5cf6', marginRight: 6, marginBottom: -2 }} />}
                            valueStyle={{ color: '#0f172a', fontWeight: 700, fontSize: '22px' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={12} md={6}>
                    <Card style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }} styles={{ body: { padding: '16px 20px' } }}>
                        <Statistic
                            title={<span style={{ color: '#64748b', fontSize: '12px', fontWeight: 600 }}>OPERATIONS</span>}
                            value={metrics.operations}
                            prefix={<Database size={16} style={{ color: '#06b6d4', marginRight: 6, marginBottom: -2 }} />}
                            valueStyle={{ color: '#0f172a', fontWeight: 700, fontSize: '22px' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={12} md={6}>
                    <Card style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }} styles={{ body: { padding: '16px 20px' } }}>
                        <Statistic
                            title={<span style={{ color: '#64748b', fontSize: '12px', fontWeight: 600 }}>SECURITY LOGS</span>}
                            value={metrics.security}
                            prefix={<Shield size={16} style={{ color: '#10b981', marginRight: 6, marginBottom: -2 }} />}
                            valueStyle={{ color: '#0f172a', fontWeight: 700, fontSize: '22px' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* FILTERS CARD */}
            <Card
                styles={{ body: { padding: '16px 20px' } }}
                style={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '24px',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.01)'
                }}
            >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 2, minWidth: 260 }}>
                        <Text strong style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>SEARCH BY PHRASE</Text>
                        <Input
                            placeholder="Trace events by description, entity, or user..."
                            prefix={<Search size={14} style={{ color: '#94a3b8' }} />}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ borderRadius: '8px', height: '38px' }}
                            allowClear
                        />
                    </div>
                    <div style={{ flex: 1.2, minWidth: 180 }}>
                        <Text strong style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>EVENT CATEGORY</Text>
                        <Select
                            value={filterType}
                            onChange={setFilterType}
                            style={{ width: '100%', height: '38px' }}
                            dropdownStyle={{ borderRadius: '8px' }}
                        >
                            <Select.Option value="ALL">All Event Manifests</Select.Option>
                            <Select.Option value="CREATE">Object Creation</Select.Option>
                            <Select.Option value="UPDATE">Update Transactions</Select.Option>
                            <Select.Option value="DELETE">Removal Operations</Select.Option>
                            <Select.Option value="IMPORT">Data Ingestion (Bulk)</Select.Option>
                            <Select.Option value="AUTOMATION_TASK">Automation Tasks</Select.Option>
                            <Select.Option value="TARGET_IMPORT">Target Ingestion</Select.Option>
                            <Select.Option value="TARGET_UPDATE">Target Updates</Select.Option>
                            <Select.Option value="TARGET_DELETE">Target Deletions</Select.Option>
                            <Select.Option value="STATUS_CHANGE">Status Changes</Select.Option>
                            <Select.Option value="AUTH_SUCCESS">Identity Verification</Select.Option>
                            <Select.Option value="AUTH_FAILURE">Security Alerts</Select.Option>
                            <Select.Option value="SYSTEM_ERROR">System Exceptions</Select.Option>
                        </Select>
                    </div>
                    <div style={{ flex: 1.5, minWidth: 220 }}>
                        <Text strong style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>DATE WINDOW</Text>
                        <RangePicker
                            value={dateRange}
                            onChange={setDateRange}
                            style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                        />
                    </div>
                    {hasActiveFilters && (
                        <div style={{ display: 'flex', alignSelf: 'flex-end', height: '38px' }}>
                            <Button
                                onClick={clearAllFilters}
                                type="text"
                                danger
                                style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                                Clear
                            </Button>
                        </div>
                    )}
                </div>
            </Card>

            {/* DATA TABLE CARD */}
            <Card
                styles={{ body: { padding: 0 } }}
                style={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    background: '#fff',
                    marginBottom: '24px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.01)'
                }}
            >
                <Table
                    columns={columns}
                    dataSource={filteredLogs}
                    rowKey={(record) => record._id || Math.random().toString()}
                    pagination={{
                        pageSize: 15,
                        showSizeChanger: true,
                        pageSizeOptions: ['15', '30', '50', '100'],
                        showTotal: (total) => <Text type="secondary" style={{ fontSize: '12px' }}>Analyzing <b>{total}</b> system operations</Text>,
                        style: { padding: '20px' }
                    }}
                    loading={loading}
                    rowClassName="premium-activity-row"
                    scroll={{ x: 'max-content' }}
                    locale={{
                        emptyText: (
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description={<Text type="secondary">No system events matched your filter criteria.</Text>}
                            />
                        )
                    }}
                />
            </Card>

            {/* DETAIL MODAL */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#6366f1'
                        }}>
                            <Activity size={18} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '15px', fontWeight: 700 }}>Event Analysis</span>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>ID: {selectedLog?._id}</span>
                        </div>
                    </div>
                }
                open={detailModalVisible}
                onCancel={() => setDetailModalVisible(false)}
                footer={[
                    <Button key="close" type="primary" onClick={() => setDetailModalVisible(false)} style={{ borderRadius: '8px', fontWeight: 600 }}>
                        CLOSE ANALYSIS
                    </Button>
                ]}
                width={650}
                centered
                styles={{ body: { padding: '20px 24px' } }}
            >
                {selectedLog && (
                    <div className="log-details-container">
                        <Descriptions title="" bordered column={2} size="small" style={{ marginBottom: '20px' }}>
                            <Descriptions.Item label="Event Type" span={1}>
                                <Tag color={getTypeStyle(selectedLog.type).color}>{getTypeStyle(selectedLog.type).label}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Entity" span={1}>
                                <Text strong>{selectedLog.entityType || 'SYSTEM'}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="Timestamp" span={2}>
                                {formatTime(selectedLog.createdAt)}
                            </Descriptions.Item>
                            <Descriptions.Item label="User" span={2}>
                                {selectedLog.user?.firstName ? `${selectedLog.user.firstName} ${selectedLog.user.lastName}` : 'System'} ({selectedLog.user?.email || 'N/A'})
                            </Descriptions.Item>
                        </Descriptions>

                        <div style={{ marginTop: '20px' }}>
                            <Text strong style={{ display: 'block', marginBottom: '8px', color: '#64748b', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>
                                Activity Description
                            </Text>
                            <div style={{
                                padding: '14px 16px',
                                backgroundColor: '#f8fafc',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                color: '#1e293b',
                                fontSize: '13px',
                                lineHeight: '1.6'
                            }}>
                                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>{selectedLog.entityTitle}</div>
                                {selectedLog.description}
                            </div>
                        </div>

                        <div style={{ marginTop: '20px' }}>
                            <Text strong style={{ display: 'block', marginBottom: '8px', color: '#64748b', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>
                                Metadata & Technical Context
                            </Text>
                            <div className="metadata-scroll-container" style={{
                                maxHeight: '250px',
                                overflowY: 'auto',
                                borderRadius: '8px',
                                border: '1px solid #f1f5f9'
                            }}>
                                {renderMetadata(selectedLog.metadata)}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <style>{`
                .premium-activity-row {
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .premium-activity-row:hover {
                    background-color: #f8fafc !important;
                }
                .ant-table-thead > tr > th {
                    background-color: #fff !important;
                    color: #64748b !important;
                    font-weight: 700 !important;
                    font-size: 11px !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.05em !important;
                    border-bottom: 1px solid #f1f5f9 !important;
                    padding: 14px 16px !important;
                }
                .ant-table-tbody > tr > td {
                    border-bottom: 1px solid #f8fafc !important;
                    padding: 14px 16px !important;
                }
                .metadata-descriptions .ant-descriptions-item-label {
                    background-color: #f8fafc !important;
                    width: 140px;
                    font-weight: 700 !important;
                    color: #64748b !important;
                }
                .metadata-descriptions .ant-descriptions-item-content {
                    font-family: 'JetBrains Mono', 'Menlo', monospace;
                    font-size: 11px;
                    color: #4f46e5;
                }
                .ant-modal-content {
                    border-radius: 16px !important;
                    overflow: hidden;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1) !important;
                }
                .ant-modal-header {
                    padding: 20px 24px 14px !important;
                    border-bottom: 1px solid #f1f5f9 !important;
                    margin-bottom: 0 !important;
                }
                .ant-modal-footer {
                    padding: 14px 24px 20px !important;
                    border-top: 1px solid #f1f5f9 !important;
                    margin-top: 0 !important;
                }
            `}</style>
        </div>
    );
};

export default ActivityLog;
