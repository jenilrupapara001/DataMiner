import React, { useState, useEffect } from 'react';
import { 
    Card, 
    Button, 
    Row, 
    Col, 
    Statistic, 
    Segmented, 
    Input, 
    List, 
    Typography, 
    Space, 
    Popconfirm, 
    Modal, 
    Empty, 
    Tag, 
    message, 
    Spin,
    Avatar,
    Tooltip,
    ConfigProvider
} from 'antd';
import { 
    Bell, 
    CheckCircle, 
    AlertTriangle, 
    Info, 
    XCircle, 
    Check, 
    Search, 
    RefreshCw, 
    MessageSquare, 
    Trash2, 
    BellRing,
    ShieldAlert,
    Calendar
} from 'lucide-react';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';

const { Title, Text, Paragraph } = Typography;

const AlertsPage = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        critical: 0,
        warning: 0,
        success: 0,
        info: 0,
        unreadCount: 0
    });
    const [filters, setFilters] = useState({
        unreadOnly: false,
        searchTerm: '',
        type: 'all'
    });
    const socket = useSocket();

    // SQL vs Mongo Robust Casing Normalizer
    const normalize = (n) => {
        if (!n) return {};
        return {
            id: n.Id || n._id || n.id,
            type: (n.Type || n.type || 'INFO').toUpperCase(),
            message: n.Message || n.message || 'No telemetry payload',
            isRead: n.IsRead === 1 || n.IsRead === true || n.isRead === 1 || n.isRead === true,
            createdAt: n.CreatedAt || n.createdAt,
            referenceId: n.ReferenceId || n.referenceId
        };
    };

    const calculateStats = (rawList, responseUnread) => {
        const normalized = rawList.map(normalize);
        setStats({
            total: normalized.length,
            critical: normalized.filter(n => n.type === 'ALERT').length,
            warning: normalized.filter(n => n.type === 'SYSTEM').length,
            success: normalized.filter(n => n.type === 'ACTION_ASSIGNED').length,
            info: normalized.filter(n => n.type === 'CHAT_MESSAGE' || n.type === 'CHAT_MENTION').length,
            unreadCount: typeof responseUnread === 'number' ? responseUnread : normalized.filter(n => !n.isRead).length
        });
    };

    const fetchNotifications = async (showSpinner = true) => {
        try {
            if (showSpinner) setLoading(true);
            const response = await api.notificationApi.getNotifications({
                unreadOnly: filters.unreadOnly,
                limit: 100
            });
            if (response && response.success) {
                const records = response.data || [];
                setNotifications(records);
                calculateStats(records, response.unreadCount);
            }
        } catch (err) {
            if (err.message && !err.message.includes('404')) {
                console.error('Alerts Sector sync error:', err);
                message.error('Operational grid sync error.');
            }
        } finally {
            if (showSpinner) setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications(true);
    }, [filters.unreadOnly]);

    // Real-time socket sync
    useEffect(() => {
        if (!socket) return;
        
        const handleNewNotification = (data) => {
            if (!data.notification) return;
            const normMsg = normalize(data.notification).message;
            setNotifications(prev => {
                const updated = [data.notification, ...prev].slice(0, 100);
                calculateStats(updated, data.unreadCount);
                return updated;
            });
            message.info({
                content: `Incoming: ${normMsg.substring(0, 50)}${normMsg.length > 50 ? '...' : ''}`,
                icon: <BellRing size={16} style={{ color: '#1890ff' }} />,
                duration: 3
            });
        };

        socket.on('new-notification', handleNewNotification);
        return () => socket.off('new-notification', handleNewNotification);
    }, [socket]);

    const acknowledgeNotification = async (id) => {
        try {
            const response = await api.notificationApi.markAsRead(id);
            if (response && response.success) {
                setNotifications(prev => {
                    const updated = prev.map(n => {
                        const current = normalize(n);
                        if (current.id === id) {
                            // Preserve case structure based on what was returned from server
                            if ('IsRead' in n) return { ...n, IsRead: 1 };
                            return { ...n, isRead: true, IsRead: 1 };
                        }
                        return n;
                    });
                    calculateStats(updated, Math.max(0, stats.unreadCount - 1));
                    return updated;
                });
                message.success('Broadcast acknowledged.');
            }
        } catch (err) {
            console.error('Write fail acknowledge:', err);
        }
    };

    const acknowledgeAll = () => {
        Modal.confirm({
            title: 'Acknowledge Notification Grid',
            content: 'Are you sure you want to clear the active unread queue?',
            okText: 'Acknowledge All',
            cancelText: 'Cancel',
            okButtonProps: { type: 'primary', danger: false, style: { borderRadius: 6 } },
            cancelButtonProps: { style: { borderRadius: 6 } },
            icon: <CheckCircle style={{ color: '#52c41a', marginRight: 8 }} size={22} />,
            async onOk() {
                try {
                    setActionLoading(true);
                    const response = await api.notificationApi.markAllAsRead();
                    if (response && response.success) {
                        setNotifications(prev => {
                            const updated = prev.map(n => {
                                if ('IsRead' in n) return { ...n, IsRead: 1 };
                                return { ...n, isRead: true, IsRead: 1 };
                            });
                            calculateStats(updated, 0);
                            return updated;
                        });
                        message.success('Grid successfully acknowledged.');
                    }
                } catch (err) {
                    console.error('Mass acknowledge command aborted:', err);
                } finally {
                    setActionLoading(false);
                }
            }
        });
    };

    const dismissAlert = async (id) => {
        try {
            await api.delete(`/notifications/${id}`);
            setNotifications(prev => {
                const updated = prev.filter(n => normalize(n).id !== id);
                // Recount
                const wasUnread = !normalize(prev.find(n => normalize(n).id === id))?.isRead;
                calculateStats(updated, wasUnread ? Math.max(0, stats.unreadCount - 1) : stats.unreadCount);
                return updated;
            });
            message.success('Broadcast purged.');
        } catch (err) {
            console.error('Purge abort, syncing:', err);
            fetchNotifications(false);
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'ALERT': return <XCircle size={16} />;
            case 'SYSTEM': return <ShieldAlert size={16} />;
            case 'ACTION_ASSIGNED': return <CheckCircle size={16} />;
            case 'CHAT_MESSAGE':
            case 'CHAT_MENTION': return <MessageSquare size={16} />;
            default: return <Info size={16} />;
        }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'ALERT': return '#ef4444'; // red
            case 'SYSTEM': return '#f59e0b'; // amber
            case 'ACTION_ASSIGNED': return '#10b981'; // green
            case 'CHAT_MESSAGE':
            case 'CHAT_MENTION': return '#8b5cf6'; // purple
            default: return '#3b82f6'; // blue
        }
    };

    const getTypeLabel = (type) => {
        switch (type) {
            case 'ALERT': return 'ALERT';
            case 'SYSTEM': return 'SYSTEM';
            case 'ACTION_ASSIGNED': return 'TASK';
            case 'CHAT_MESSAGE':
            case 'CHAT_MENTION': return 'CHAT';
            default: return 'INFO';
        }
    };

    // Client filters on normalized schema
    const displayList = notifications
        .map(n => ({ ...normalize(n), _raw: n }))
        .filter(n => {
            const matchesType = 
                filters.type === 'all' ||
                n.type === filters.type ||
                (filters.type === 'CHAT_MESSAGE' && (n.type === 'CHAT_MESSAGE' || n.type === 'CHAT_MENTION'));
                
            const matchesSearch = 
                filters.searchTerm === '' ||
                n.message.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                n.type.toLowerCase().includes(filters.searchTerm.toLowerCase());
                
            return matchesType && matchesSearch;
        });

    // Formatter
    const formatTimestamp = (dateString) => {
        if (!dateString) return '--';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '--';
        
        return d.toLocaleString([], { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    return (
        <ConfigProvider
            theme={{
                token: {
                    borderRadius: 8,
                    colorPrimary: '#1e293b'
                }
            }}
        >
            <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto', minHeight: '100vh', backgroundColor: '#fcfcfd' }}>
                {/* Dash Indicator */}
                {loading && (
                    <div style={{ 
                        position: 'fixed', 
                        top: 0, 
                        left: 0, 
                        width: '100%', 
                        height: '3px', 
                        zIndex: 9999, 
                        backgroundColor: '#e2e8f0'
                    }}>
                        <div className="sync-bar-pulse" />
                    </div>
                )}

                {/* Top Header Segment */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <Title level={2} style={{ margin: 0, fontWeight: 750, letterSpacing: '-0.03em', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Bell style={{ color: '#475569' }} size={26} />
                            Operational Alerts
                        </Title>
                        <Text style={{ fontSize: 14, color: '#64748b', fontWeight: 450 }}>
                            Real-time monitoring array mapping system triggers, background tasks, and chat notifications.
                        </Text>
                    </div>
                    
                    <Space size="middle">
                        <Button 
                            onClick={() => fetchNotifications(true)} 
                            icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
                            disabled={loading}
                            style={{ borderRadius: 6, height: 36, fontWeight: 600, color: '#475569' }}
                        >
                            Sync Data
                        </Button>
                        <Button 
                            type="primary" 
                            onClick={acknowledgeAll} 
                            disabled={stats.unreadCount === 0 || actionLoading}
                            style={{ borderRadius: 6, height: 36, fontWeight: 600, backgroundColor: '#0f172a', border: 'none' }}
                        >
                            Mark All As Read
                        </Button>
                    </Space>
                </div>

                {/* Professional Scoreboard KPIs */}
                <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
                    {[
                        { label: 'Unread Buffer', value: stats.unreadCount, icon: Bell, color: '#2563eb', bgColor: '#eff6ff' },
                        { label: 'Critical Incidents', value: stats.critical, icon: XCircle, color: '#dc2626', bgColor: '#fef2f2' },
                        { label: 'Completed Operations', value: stats.success, icon: CheckCircle, color: '#16a34a', bgColor: '#f0fdf4' },
                        { label: 'System Invocations', value: stats.warning, icon: ShieldAlert, color: '#d97706', bgColor: '#fef3c7' }
                    ].map((stat, idx) => (
                        <Col xs={12} md={6} key={idx}>
                            <Card bordered={false} style={{ 
                                borderRadius: 12, 
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.06)',
                                border: '1px solid #e2e8f0',
                                backgroundColor: '#fff'
                            }} bodyStyle={{ padding: '20px 24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: 4 }}>
                                            {stat.label}
                                        </div>
                                        <Statistic 
                                            value={stat.value}
                                            valueStyle={{ fontWeight: 800, fontSize: 28, color: '#0f172a', lineHeight: 1 }}
                                        />
                                    </div>
                                    <div style={{ 
                                        width: 42, 
                                        height: 42, 
                                        borderRadius: 8, 
                                        backgroundColor: stat.bgColor, 
                                        color: stat.color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <stat.icon size={20} strokeWidth={2.2} />
                                    </div>
                                </div>
                            </Card>
                        </Col>
                    ))}
                </Row>

                {/* Filtering Workspace Panel */}
                <Card bordered={false} style={{ 
                    borderRadius: 12, 
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)', 
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    marginBottom: 16
                }} bodyStyle={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <Space size="middle" style={{ flexWrap: 'wrap' }}>
                            <Segmented
                                options={[
                                    { label: 'Recent Logs', value: false },
                                    { label: 'Unread Only', value: true }
                                ]}
                                value={filters.unreadOnly}
                                onChange={(v) => setFilters(prev => ({ ...prev, unreadOnly: v }))}
                                style={{ borderRadius: 6, padding: 2, backgroundColor: '#f1f5f9' }}
                            />

                            <Segmented
                                options={[
                                    { label: 'All Buffers', value: 'all' },
                                    { label: 'Alerts', value: 'ALERT' },
                                    { label: 'System', value: 'SYSTEM' },
                                    { label: 'Tasks', value: 'ACTION_ASSIGNED' },
                                    { label: 'Chats', value: 'CHAT_MESSAGE' }
                                ]}
                                value={filters.type}
                                onChange={(v) => setFilters(prev => ({ ...prev, type: v }))}
                                style={{ borderRadius: 6, padding: 2, backgroundColor: '#f1f5f9' }}
                            />
                        </Space>

                        <Input 
                            placeholder="Query tracking buffer..." 
                            prefix={<Search size={16} style={{ color: '#94a3b8', marginRight: 4 }} />}
                            allowClear
                            value={filters.searchTerm}
                            onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                            style={{ width: 260, borderRadius: 6, height: 36 }}
                        />
                    </div>
                </Card>

                {/* Main Broadcast Stack */}
                <Spin spinning={loading}>
                    <Card bordered={false} style={{ 
                        borderRadius: 12, 
                        border: '1px solid #e2e8f0', 
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)', 
                        backgroundColor: '#fff' 
                    }} bodyStyle={{ padding: 0 }}>
                        {displayList.length === 0 ? (
                            <div style={{ padding: '60px 0', textAlign: 'center' }}>
                                <Empty 
                                    image={Empty.PRESENTED_IMAGE_SIMPLE} 
                                    description={
                                        <div style={{ marginTop: 8 }}>
                                            <Text strong style={{ color: '#475569', fontSize: 15 }}>Static Matrix Channel</Text>
                                            <Paragraph style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
                                                No active incident logs detected inside selected metrics.
                                            </Paragraph>
                                        </div>
                                    }
                                />
                            </div>
                        ) : (
                            <List
                                itemLayout="horizontal"
                                dataSource={displayList}
                                split={true}
                                renderItem={(item) => (
                                    <List.Item 
                                        key={item.id}
                                        style={{ 
                                            padding: '16px 24px',
                                            backgroundColor: item.isRead ? 'transparent' : 'rgba(239, 246, 255, 0.4)',
                                            transition: 'all 0.2s',
                                            borderBottom: '1px solid #f1f5f9'
                                        }}
                                        className="broadcast-row-interactive"
                                    >
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, width: '100%' }}>
                                            {/* Left Status Indicator Icon */}
                                            <Avatar 
                                                size={40}
                                                style={{ 
                                                    backgroundColor: `${getTypeColor(item.type)}10`, 
                                                    color: getTypeColor(item.type),
                                                    border: `1px solid ${getTypeColor(item.type)}25`,
                                                    flexShrink: 0,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginTop: 2
                                                }}
                                                icon={getTypeIcon(item.type)}
                                            />

                                            {/* Center Telemetry Summary */}
                                            <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <Space size="small">
                                                        <Tag color={getTypeColor(item.type)} style={{ 
                                                            borderRadius: 4, 
                                                            fontSize: 10, 
                                                            fontWeight: 850, 
                                                            letterSpacing: '0.04em',
                                                            border: 'none',
                                                            padding: '0px 8px',
                                                            lineHeight: '20px'
                                                        }}>
                                                            {getTypeLabel(item.type)}
                                                        </Tag>
                                                        {!item.isRead && (
                                                            <Badge status="processing" style={{ marginLeft: 4 }} text={
                                                                <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb' }}>NEW</span>
                                                            } />
                                                        )}
                                                    </Space>
                                                    
                                                    <Space size={4} style={{ color: '#94a3b8', fontSize: 12 }}>
                                                        <Calendar size={12} />
                                                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>
                                                            {formatTimestamp(item.createdAt)}
                                                        </Text>
                                                    </Space>
                                                </div>
                                                
                                                <Text 
                                                    strong={!item.isRead} 
                                                    style={{ 
                                                        fontSize: 14, 
                                                        color: item.isRead ? '#475569' : '#0f172a',
                                                        fontWeight: item.isRead ? 450 : 600,
                                                        lineHeight: 1.5,
                                                        wordBreak: 'break-word',
                                                        marginTop: 2
                                                    }}
                                                >
                                                    {item.message}
                                                </Text>
                                            </div>

                                            {/* Action Module Controls */}
                                            <div style={{ flexShrink: 0, marginLeft: 12, alignSelf: 'center' }}>
                                                <Space size="small">
                                                    {!item.isRead && (
                                                        <Tooltip title="Mark As Read">
                                                            <Button 
                                                                type="text" 
                                                                size="middle"
                                                                onClick={() => acknowledgeNotification(item.id)}
                                                                icon={<Check size={16} style={{ color: '#16a34a' }} />}
                                                                style={{ 
                                                                    backgroundColor: '#f0fdf4', 
                                                                    border: '1px solid #dcfce7',
                                                                    borderRadius: 6 
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                    <Popconfirm
                                                        title="Purge this broadcast?"
                                                        description="Proceed to erase from logging queue?"
                                                        okText="Purge"
                                                        cancelText="Cancel"
                                                        okButtonProps={{ danger: true, style: { borderRadius: 4 } }}
                                                        cancelButtonProps={{ style: { borderRadius: 4 } }}
                                                        onConfirm={() => dismissAlert(item.id)}
                                                        placement="left"
                                                    >
                                                        <Tooltip title="Purge Trace">
                                                            <Button 
                                                                type="text" 
                                                                size="middle"
                                                                danger
                                                                icon={<Trash2 size={15} />}
                                                                style={{ 
                                                                    backgroundColor: '#fef2f2', 
                                                                    border: '1px solid #fee2e2',
                                                                    borderRadius: 6 
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    </Popconfirm>
                                                </Space>
                                            </div>
                                        </div>
                                    </List.Item>
                                )}
                            />
                        )}
                    </Card>
                </Spin>

                <style>{`
                    .animate-spin {
                        animation: spin 1.2s linear infinite;
                    }
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    .sync-bar-pulse {
                        width: 30%;
                        height: 100%;
                        background-color: #0f172a;
                        animation: pulse-bar 1.6s infinite ease-in-out;
                    }
                    @keyframes pulse-bar {
                        0% { margin-left: -30%; }
                        100% { margin-left: 100%; }
                    }
                    .broadcast-row-interactive:hover {
                        background-color: #f8fafc !important;
                    }
                `}</style>
            </div>
        </ConfigProvider>
    );
};

export default AlertsPage;