import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { 
  Card, Table, Input, Select, Badge, Avatar, Space, 
  Typography, Button, Tag, Tooltip, Modal, Empty, Descriptions
} from 'antd';
import { 
  Clock, Search, ArrowRight, CheckCircle, 
  PlusCircle, Trash2, Edit3, ClipboardList, Activity, RefreshCw, ChevronRight,
  Info, Eye, Filter, User, HardDrive, Box, Shield, LogIn, LogOut, XCircle, AlertTriangle
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';

const { Title, Text, Paragraph } = Typography;

const ActivityLog = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [selectedLog, setSelectedLog] = useState(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);

    useEffect(() => {
        loadLogs();
    }, []);

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

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch = searchQuery
                ? (log.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (log.entityTitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (log.user?.email || '').toLowerCase().includes(searchQuery.toLowerCase())
                : true;
            const matchesType = filterType === 'ALL' || log.type === filterType;
            return matchesSearch && matchesType;
        });
    }, [logs, searchQuery, filterType]);

    const showDetails = (log) => {
        setSelectedLog(log);
        setDetailModalVisible(true);
    };

    const renderMetadata = (metadata) => {
        if (!metadata) return <Text type="secondary">No technical data available.</Text>;
        
        let data = metadata;
        if (typeof metadata === 'string') {
            try { data = JSON.parse(metadata); } catch (e) { return <pre>{metadata}</pre>; }
        }

        if (typeof data !== 'object') return <pre>{JSON.stringify(data)}</pre>;

        return (
            <Descriptions bordered size="small" column={1} className="metadata-descriptions">
                {Object.entries(data).map(([key, value]) => (
                    <Descriptions.Item label={key.charAt(0).toUpperCase() + key.slice(1)} key={key}>
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
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
            width: 180,
            sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
            render: (val) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Space size={4} style={{ color: '#1e293b', fontWeight: 500, fontSize: '12px' }}>
                        <Clock size={12} />
                        <span>{new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </Space>
                    <Text type="secondary" style={{ fontSize: '10px', marginLeft: '16px' }}>
                        {new Date(val).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    </Text>
                </div>
            )
        },
        {
            title: 'Event',
            dataIndex: 'type',
            key: 'type',
            width: 150,
            render: (type) => {
                const conf = getTypeStyle(type);
                return (
                    <Tag 
                        style={{ 
                            backgroundColor: `${conf.color}10`, 
                            color: conf.color, 
                            borderColor: `${conf.color}20`,
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            borderRadius: '8px', 
                            padding: '2px 10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            fontSize: '10px'
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
                        style={{ borderRadius: '6px', fontSize: '10px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
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
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px', marginBottom: '2px' }}>
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
            width: 200,
            render: (_, record) => {
                const name = record.user?.firstName ? `${record.user.firstName} ${record.user.lastName || ''}` : (record.user?.username || 'System');
                const email = record.user?.email || '';
                const initial = name.charAt(0).toUpperCase();
                return (
                    <Space size="middle">
                        <Avatar 
                            size={32} 
                            style={{ 
                                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', 
                                color: '#fff', 
                                fontWeight: 800, 
                                fontSize: '12px',
                                boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)'
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
            width: 80,
            align: 'center',
            render: (_, record) => (
                <Tooltip title="View Detailed Log">
                    <Button 
                        type="text" 
                        shape="circle" 
                        icon={<Eye size={16} />} 
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

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            backgroundColor: '#f8fafc',
            margin: '-1.5rem -2rem',
            padding: '1.5rem 2rem',
            fontFamily: "'DM Sans', sans-serif"
        }}>
            {/* HEADER AREA */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                marginBottom: '2rem'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                        <Activity size={14} />
                        <span>System Intelligence</span>
                        <ChevronRight size={12} />
                        <span style={{ color: '#0f172a' }}>Strategy & Execution Log</span>
                    </div>
                    <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.03em', color: '#0f172a' }}>
                        Activity Streams
                    </Title>
                    <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
                        Real-time audit trail of all administrative and automated actions within the platform.
                    </Paragraph>
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button 
                        onClick={loadLogs}
                        loading={loading}
                        icon={<RefreshCw size={16} />}
                        style={{ 
                            borderRadius: '12px', 
                            height: '42px', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            fontWeight: 700,
                            padding: '0 20px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#fff',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    >
                        SYNC STREAMS
                    </Button>
                </div>
            </div>

            {/* FILTERS CARD */}
            <Card 
                styles={{ body: { padding: '20px' } }} 
                style={{ 
                    borderRadius: '20px', 
                    border: '1px solid #f1f5f9', 
                    boxShadow: '0 4px 20px -4px rgba(0,0,0,0.05)',
                    marginBottom: '1.5rem',
                    background: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(10px)'
                }}
            >
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                        <Input 
                            placeholder="Trace events by description, entity, or user signature..."
                            prefix={<Search size={18} style={{ color: '#94a3b8', marginRight: 8 }} />}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ 
                                borderRadius: '12px', 
                                height: '48px', 
                                border: '1px solid #e2e8f0',
                                fontSize: '14px'
                            }}
                            allowClear
                        />
                    </div>
                    <div style={{ width: '260px' }}>
                        <Select
                            value={filterType}
                            onChange={setFilterType}
                            style={{ width: '100%', height: '48px' }}
                            dropdownStyle={{ borderRadius: '12px', padding: '8px' }}
                            suffixIcon={<Filter size={16} />}
                        >
                            <Select.Option value="ALL">All Event Manifests</Select.Option>
                            <Select.Option value="CREATE">Object Creation</Select.Option>
                            <Select.Option value="UPDATE">Update Transactions</Select.Option>
                            <Select.Option value="DELETE">Removal Operations</Select.Option>
                            <Select.Option value="IMPORT">Data Ingestion (Bulk)</Select.Option>
                            <Select.Option value="AUTH_SUCCESS">Identity Verification</Select.Option>
                            <Select.Option value="AUTH_FAILURE">Security Alerts</Select.Option>
                            <Select.Option value="SYSTEM_ERROR">System Exceptions</Select.Option>
                        </Select>
                    </div>
                </div>
            </Card>

            {/* DATA TABLE CARD */}
            <Card 
                styles={{ body: { padding: 0 } }}
                style={{ 
                    borderRadius: '24px', 
                    border: '1px solid #f1f5f9', 
                    overflow: 'hidden',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.02)',
                    background: '#fff'
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
                            <span style={{ fontSize: '16px', fontWeight: 800 }}>Event Analysis</span>
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
                styles={{ body: { padding: '24px' } }}
            >
                {selectedLog && (
                    <div className="log-details-container">
                        <Descriptions title="Overview" bordered column={2} size="small">
                            <Descriptions.Item label="Event Type" span={1}>
                                <Tag color={getTypeStyle(selectedLog.type).color}>{getTypeStyle(selectedLog.type).label}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Entity" span={1}>
                                <Text strong>{selectedLog.entityType}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="Timestamp" span={2}>
                                {formatTime(selectedLog.createdAt)}
                            </Descriptions.Item>
                            <Descriptions.Item label="User" span={2}>
                                {selectedLog.user?.firstName ? `${selectedLog.user.firstName} ${selectedLog.user.lastName}` : 'System'} ({selectedLog.user?.email || 'N/A'})
                            </Descriptions.Item>
                        </Descriptions>

                        <div style={{ marginTop: '24px' }}>
                            <Text strong style={{ display: 'block', marginBottom: '8px', color: '#64748b', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>
                                Activity Description
                            </Text>
                            <div style={{ 
                                padding: '16px', 
                                backgroundColor: '#f8fafc', 
                                borderRadius: '12px', 
                                border: '1px solid #e2e8f0',
                                color: '#1e293b',
                                fontWeight: 600,
                                fontSize: '14px',
                                lineHeight: '1.6'
                            }}>
                                <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '4px' }}>{selectedLog.entityTitle}</div>
                                {selectedLog.description}
                            </div>
                        </div>

                        <div style={{ marginTop: '24px' }}>
                            <Text strong style={{ display: 'block', marginBottom: '8px', color: '#64748b', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>
                                Metadata & Technical Context
                            </Text>
                            <div className="metadata-scroll-container" style={{ 
                                maxHeight: '300px', 
                                overflowY: 'auto',
                                borderRadius: '12px',
                                border: '1px solid #f1f5f9'
                            }}>
                                {renderMetadata(selectedLog.metadata)}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=swap');

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
                    padding: 16px 20px !important;
                }
                .ant-table-tbody > tr > td {
                    border-bottom: 1px solid #f8fafc !important;
                    padding: 16px 20px !important;
                }
                .metadata-descriptions .ant-descriptions-item-label {
                    background-color: #f8fafc !important;
                    width: 150px;
                    font-weight: 700 !important;
                    color: #64748b !important;
                }
                .metadata-descriptions .ant-descriptions-item-content {
                    font-family: 'JetBrains Mono', 'Menlo', monospace;
                    font-size: 12px;
                    color: #4f46e5;
                }
                .ant-modal-content {
                    border-radius: 24px !important;
                    overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
                }
                .ant-modal-header {
                    padding: 24px 24px 16px !important;
                    border-bottom: 1px solid #f1f5f9 !important;
                    margin-bottom: 0 !important;
                }
                .ant-modal-footer {
                    padding: 16px 24px 24px !important;
                    border-top: 1px solid #f1f5f9 !important;
                    margin-top: 0 !important;
                }
            `}</style>
        </div>
    );
};

export default ActivityLog;
