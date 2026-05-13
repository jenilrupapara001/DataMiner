import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { 
  Card, Table, Input, Select, Badge, Avatar, Space, 
  Typography, Button, Tag, Tooltip 
} from 'antd';
import { 
  Clock, Search, ArrowRight, CheckCircle, 
  PlusCircle, Trash2, Edit3, ClipboardList, Activity, RefreshCw, ChevronRight 
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';

const { Title, Text } = Typography;

const ActivityLog = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('ALL');

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await db.getSystemLogs();
            // Normalize API response to account for SQL Server PascalCase variations!
            const normalized = (data || []).map(log => ({
                ...log,
                _id: log._id || log.id || log.Id,
                createdAt: log.createdAt || log.CreatedAt,
                type: log.type || log.Type || '',
                entityType: log.entityType || log.EntityType || '',
                entityTitle: log.entityTitle || log.EntityTitle || '',
                description: log.description || log.Description || ''
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
                return { icon: <PlusCircle size={14} />, color: 'success', label: 'Creation' };
            case 'UPDATE': 
                return { icon: <Edit3 size={14} />, color: 'processing', label: 'Update' };
            case 'DELETE': 
                return { icon: <Trash2 size={14} />, color: 'error', label: 'Deletion' };
            case 'STATUS_CHANGE': 
                return { icon: <CheckCircle size={14} />, color: 'warning', label: 'Status' };
            case 'AUTH_SUCCESS': 
                return { icon: <CheckCircle size={14} />, color: 'success', label: 'Login Success' };
            case 'AUTH_FAILURE': 
                return { icon: <Trash2 size={14} />, color: 'error', label: 'Login Failure' };
            case 'AUTH_LOGOUT': 
                return { icon: <ArrowRight size={14} />, color: 'default', label: 'Logout' };
            case 'SYSTEM_ERROR': 
                return { icon: <Activity size={14} />, color: 'error', label: 'Error' };
            case 'IMPORT': 
                return { icon: <ClipboardList size={14} />, color: 'cyan', label: 'Import' };
            default: 
                return { icon: <ClipboardList size={14} />, color: 'default', label: t.replace('_', ' ') || 'System' };
        }
    };

    const getEntityColor = (type = '') => {
        const styles = {
            OBJECTIVE: 'blue',
            KR: 'cyan',
            ACTION: 'orange',
            SYSTEM: 'default',
            USER: 'purple',
            SERVER: 'volcano',
            SELLER: 'green',
            ASIN: 'geekblue',
            MONTHLY_DATA: 'magenta'
        };
        return styles[type] || 'default';
    };

    const formatTime = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
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

    const columns = [
        {
            title: 'Timestamp',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 180,
            render: (val) => (
                <Space size="small" className="text-secondary" style={{ fontSize: '12px' }}>
                    <Clock size={12} />
                    <span>{formatTime(val)}</span>
                </Space>
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
                    <Tag color={conf.color} icon={conf.icon} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '6px', fontWeight: 600, textTransform: 'uppercase', fontSize: '10px' }}>
                        {conf.label}
                    </Tag>
                );
            }
        },
        {
            title: 'Entity',
            dataIndex: 'entityType',
            key: 'entityType',
            width: 140,
            render: (type) => (
                <Tag color={getEntityColor(type)} style={{ borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
                    {type || 'SYSTEM'}
                </Tag>
            )
        },
        {
            title: 'Activity Description',
            key: 'activity',
            render: (_, record) => (
                <div>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '13px' }}>{record.entityTitle || 'N/A'}</div>
                    <Tooltip title={record.description}>
                        <div className="text-muted" style={{ fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '500px' }}>
                            {record.description || 'No additional details.'}
                        </div>
                    </Tooltip>
                </div>
            )
        },
        {
            title: 'Initiated By',
            key: 'user',
            width: 220,
            render: (_, record) => {
                const name = record.user?.firstName || record.user?.username || 'System';
                const email = record.user?.email || '';
                const initial = name.charAt(0).toUpperCase();
                return (
                    <Space size="middle">
                        <Avatar size="small" style={{ backgroundColor: '#EEF2FF', color: '#4f46e5', fontWeight: 'bold', fontSize: '11px', border: '1px solid #e0e7ff' }}>
                            {initial}
                        </Avatar>
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                            <Text strong style={{ fontSize: '12px' }}>{name}</Text>
                            {email && <Text type="secondary" style={{ fontSize: '10px' }}>{email}</Text>}
                        </div>
                    </Space>
                );
            }
        }
    ];

    if (loading && logs.length === 0) {
        return <PageLoader message="Loading Activity Log..." />;
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            backgroundColor: '#f4f7fe',
            margin: '-1.5rem -2rem',
            padding: '1.5rem 2rem'
        }}>
            {/* TOP NAVIGATION AND FILTER HEADER */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
            }}>
                <div>
                    <div className="d-flex align-items-center gap-2 text-secondary small fw-medium mb-1">
                        <span style={{ fontSize: '11px' }}>System</span> <ChevronRight size={11} /> <span className="text-dark fw-semibold" style={{ fontSize: '11px' }}>Activity Log</span>
                    </div>
                    <Title level={4} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>Strategy & Execution Log</Title>
                </div>
                
                <Button 
                    type="primary"
                    onClick={loadLogs}
                    loading={loading}
                    icon={<RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
                    style={{ borderRadius: '8px', height: '36px', display: 'inline-flex', alignItems: 'center', fontWeight: 600 }}
                >
                    REFRESH LOGS
                </Button>
            </div>

            {/* DASHBOARD METRIC/FILTER CARD */}
            <Card 
                styles={{ body: { padding: '16px' } }} 
                style={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
                    marginBottom: '1.5rem'
                }}
            >
                <div className="d-flex gap-3 align-items-center flex-wrap flex-md-nowrap">
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Input 
                            placeholder="Search by description, title, or user..."
                            prefix={<Search size={16} style={{ color: '#94a3b8', marginRight: 4 }} />}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ borderRadius: '8px', height: '38px' }}
                            allowClear
                        />
                    </div>
                    <div style={{ width: '240px' }}>
                        <Select
                            value={filterType}
                            onChange={setFilterType}
                            style={{ width: '100%', height: '38px' }}
                            dropdownStyle={{ borderRadius: '8px' }}
                            size="middle"
                        >
                            <Select.Option value="ALL">All Event Types</Select.Option>
                            <Select.Option value="CREATE">Creation</Select.Option>
                            <Select.Option value="UPDATE">Updates</Select.Option>
                            <Select.Option value="DELETE">Deletions</Select.Option>
                            <Select.Option value="IMPORT">Data Imports</Select.Option>
                            <Select.Option value="AUTH_SUCCESS">Successful Logins</Select.Option>
                            <Select.Option value="AUTH_FAILURE">Login Failures</Select.Option>
                            <Select.Option value="SYSTEM_ERROR">System Errors</Select.Option>
                            <Select.Option value="STATUS_CHANGE">Status Changes</Select.Option>
                        </Select>
                    </div>
                </div>
            </Card>

            {/* HIGH FIDELITY LOG TABLE */}
            <Card 
                styles={{ body: { padding: 0 } }}
                style={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    overflow: 'hidden',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.02)'
                }}
            >
                <Table
                    columns={columns}
                    dataSource={filteredLogs}
                    rowKey={(record) => record._id || Math.random().toString()}
                    pagination={{
                        pageSize: 15,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '15', '30', '50'],
                        showTotal: (total) => `Total ${total} activities`,
                        style: { paddingRight: '16px' }
                    }}
                    loading={loading}
                    rowClassName="activity-table-row"
                    scroll={{ x: 'max-content' }}
                />
            </Card>

            <style>{`
                .activity-table-row {
                    transition: background-color 0.2s ease;
                }
                .activity-table-row:hover {
                    background-color: #f8fafc !important;
                    cursor: pointer;
                }
                .ant-table-thead > tr > th {
                    background-color: #fafbfc !important;
                    color: #475569 !important;
                    font-weight: 700 !important;
                    font-size: 11px !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.02em !important;
                    border-bottom: 1px solid #f1f5f9 !important;
                }
                .ant-table-tbody > tr > td {
                    border-bottom: 1px solid #f1f5f9 !important;
                    padding: 12px 16px !important;
                }
            `}</style>
        </div>
    );
};

export default ActivityLog;
