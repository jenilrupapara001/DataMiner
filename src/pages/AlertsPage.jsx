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
    ConfigProvider,
    Checkbox
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
    Calendar,
    CheckSquare,
    Square
} from 'lucide-react';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';

const { Title, Text, Paragraph } = Typography;

const AlertsPage = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    
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
        setSelectedIds(new Set()); // Reset selections when filters change
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
                icon: <BellRing size={16} style={{ color: '#1976D2' }} />,
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
            okButtonProps: { type: 'primary', style: { borderRadius: 8, backgroundColor: '#1976D2', borderColor: '#1976D2' } },
            cancelButtonProps: { style: { borderRadius: 8 } },
            icon: <CheckCircle style={{ color: '#2E7D32', marginRight: 8 }} size={22} />,
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
                        setSelectedIds(new Set());
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
                const wasUnread = !normalize(prev.find(n => normalize(n).id === id))?.isRead;
                calculateStats(updated, wasUnread ? Math.max(0, stats.unreadCount - 1) : stats.unreadCount);
                return updated;
            });
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            message.success('Broadcast purged.');
        } catch (err) {
            console.error('Purge abort, syncing:', err);
            fetchNotifications(false);
        }
    };

    // Bulk/Batch Actions
    const handleBulkAcknowledge = async () => {
        setActionLoading(true);
        try {
            const ids = Array.from(selectedIds);
            await Promise.all(ids.map(id => api.notificationApi.markAsRead(id)));
            setNotifications(prev => {
                const updated = prev.map(n => {
                    const current = normalize(n);
                    if (selectedIds.has(current.id)) {
                        if ('IsRead' in n) return { ...n, IsRead: 1 };
                        return { ...n, isRead: true, IsRead: 1 };
                    }
                    return n;
                });
                calculateStats(updated);
                return updated;
            });
            setSelectedIds(new Set());
            message.success(`Successfully acknowledged ${ids.length} alerts.`);
        } catch (err) {
            console.error('Batch acknowledge error:', err);
            message.error('Failed to acknowledge some alerts.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleBulkDelete = () => {
        Modal.confirm({
            title: 'Batch Delete Alerts',
            content: `Are you sure you want to permanently delete the ${selectedIds.size} selected alerts?`,
            okText: 'Delete Selected',
            okType: 'danger',
            cancelText: 'Cancel',
            okButtonProps: { style: { borderRadius: 8 } },
            cancelButtonProps: { style: { borderRadius: 8 } },
            async onOk() {
                setActionLoading(true);
                try {
                    const ids = Array.from(selectedIds);
                    await Promise.all(ids.map(id => api.delete(`/notifications/${id}`)));
                    setNotifications(prev => {
                        const updated = prev.filter(n => !selectedIds.has(normalize(n).id));
                        calculateStats(updated);
                        return updated;
                    });
                    setSelectedIds(new Set());
                    message.success(`Successfully deleted ${ids.length} alerts.`);
                } catch (err) {
                    console.error('Batch delete error:', err);
                    message.error('Failed to delete some alerts.');
                } finally {
                    setActionLoading(false);
                }
            }
        });
    };

    const toggleRowSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
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
            case 'ALERT': return '#D32F2F'; // red
            case 'SYSTEM': return '#ED6C02'; // amber
            case 'ACTION_ASSIGNED': return '#2E7D32'; // green
            case 'CHAT_MESSAGE':
            case 'CHAT_MENTION': return '#9C27B0'; // purple
            default: return '#0288D1'; // blue
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

    const isAllSelected = displayList.length > 0 && displayList.every(item => selectedIds.has(item.id));

    const toggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds(prev => {
                const next = new Set(prev);
                displayList.forEach(item => next.delete(item.id));
                return next;
            });
        } else {
            setSelectedIds(prev => {
                const next = new Set(prev);
                displayList.forEach(item => next.add(item.id));
                return next;
            });
        }
    };

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
                    borderRadius: 12,
                    colorPrimary: '#1976D2'
                }
            }}
        >
            <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
                {/* Dash Indicator */}
                {loading && (
                    <div style={{ 
                        position: 'fixed', 
                        top: 0, 
                        left: 0, 
                        width: '100%', 
                        height: '3px', 
                        zIndex: 9999, 
                        backgroundColor: '#e0e7ff'
                    }}>
                        <div className="sync-bar-pulse" />
                    </div>
                )}

                {/* Top Header Segment */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.025em', color: '#111827', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Bell style={{ color: '#1976D2' }} size={26} />
                            Operational Alerts
                        </Title>
                        <Text style={{ fontSize: 13.5, color: '#4b5563', fontWeight: 500 }}>
                            Real-time monitoring array mapping system triggers, background tasks, and chat notifications.
                        </Text>
                    </div>
                    
                    <Space size="middle">
                        <Button 
                            onClick={() => fetchNotifications(true)} 
                            icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
                            disabled={loading}
                            style={{ borderRadius: '8px', height: 38, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            Sync Data
                        </Button>
                        <Button 
                            type="primary" 
                            onClick={acknowledgeAll} 
                            disabled={stats.unreadCount === 0 || actionLoading}
                            style={{ borderRadius: '8px', height: 38, fontWeight: 700, backgroundColor: '#1976D2', borderColor: '#1976D2', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.15)' }}
                        >
                            Mark All As Read
                        </Button>
                    </Space>
                </div>

                {/* Professional Scoreboard KPIs */}
                <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
                    {[
                        { label: 'Unread Buffer', value: stats.unreadCount, icon: Bell, color: '#1976D2', bgColor: '#eeebff' },
                        { label: 'Critical Incidents', value: stats.critical, icon: XCircle, color: '#D32F2F', bgColor: '#fef2f2' },
                        { label: 'Completed Operations', value: stats.success, icon: CheckCircle, color: '#2E7D32', bgColor: '#f0fdf4' },
                        { label: 'System Invocations', value: stats.warning, icon: ShieldAlert, color: '#ED6C02', bgColor: '#fffbeb' }
                    ].map((stat, idx) => (
                        <Col xs={12} md={6} key={idx}>
                            <Card variant="borderless" style={{ 
                                borderRadius: 16, 
                                boxShadow: '0 4px 18px rgba(0,0,0,0.02), 0 1px 3px rgba(0,0,0,0.01)',
                                border: '1px solid #f3f4f6',
                                backgroundColor: '#fff',
                                overflow: 'hidden'
                            }} styles={{ body: { padding: '24px' } }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', marginBottom: 6 }}>
                                            {stat.label}
                                        </div>
                                        <Statistic 
                                            value={stat.value}
                                            valueStyle={{ fontWeight: 800, fontSize: 30, color: '#111827', letterSpacing: '-0.02em', lineHeight: 1 }}
                                        />
                                    </div>
                                    <div style={{ 
                                        width: 44, 
                                        height: 44, 
                                        borderRadius: 10, 
                                        backgroundColor: stat.bgColor, 
                                        color: stat.color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                                    }}>
                                        <stat.icon size={20} strokeWidth={2.4} />
                                    </div>
                                </div>
                            </Card>
                        </Col>
                    ))}
                </Row>

                {/* Filtering Workspace Panel */}
                <Card variant="borderless" style={{ 
                    borderRadius: 16, 
                    boxShadow: '0 4px 18px rgba(0,0,0,0.02)', 
                    border: '1px solid #f3f4f6',
                    backgroundColor: '#ffffff',
                    marginBottom: 16
                }} styles={{ body: { padding: '16px 20px' } }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <Space size="middle" style={{ flexWrap: 'wrap' }}>
                            <Segmented
                                options={[
                                    { label: 'Recent Logs', value: false },
                                    { label: 'Unread Only', value: true }
                                ]}
                                value={filters.unreadOnly}
                                onChange={(v) => setFilters(prev => ({ ...prev, unreadOnly: v }))}
                                style={{ borderRadius: '8px', padding: 2, backgroundColor: '#f3f4f6' }}
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
                                style={{ borderRadius: '8px', padding: 2, backgroundColor: '#f3f4f6' }}
                            />
                        </Space>

                        <Input 
                            placeholder="Query tracking buffer..." 
                            prefix={<Search size={16} style={{ color: '#9ca3af', marginRight: 6 }} />}
                            allowClear
                            value={filters.searchTerm}
                            onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                            style={{ width: 280, borderRadius: '8px', height: 38 }}
                        />
                    </div>
                </Card>

                {/* Main Broadcast Stack */}
                <Spin spinning={loading}>
                    <Card variant="borderless" style={{ 
                        borderRadius: 16, 
                        border: '1px solid #f3f4f6', 
                        boxShadow: '0 4px 18px rgba(0,0,0,0.02)', 
                        backgroundColor: '#fff',
                        overflow: 'hidden'
                    }} styles={{ body: { padding: 0 } }}>
                        {displayList.length === 0 ? (
                            <div style={{ padding: '80px 0', textAlign: 'center' }}>
                                <Empty 
                                    image={Empty.PRESENTED_IMAGE_SIMPLE} 
                                    description={
                                        <div style={{ marginTop: 8 }}>
                                            <Text strong style={{ color: '#374151', fontSize: 15 }}>Static Matrix Channel</Text>
                                            <Paragraph style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0 0' }}>
                                                No active incident logs detected inside selected metrics.
                                            </Paragraph>
                                        </div>
                                    }
                                />
                            </div>
                        ) : (
                            <div>
                                {/* Select All Action Header */}
                                <div style={{ 
                                    padding: '12px 24px', 
                                    borderBottom: '1px solid #f3f4f6', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '12px',
                                    background: '#f9fafb'
                                }}>
                                    <Checkbox
                                        checked={isAllSelected}
                                        indeterminate={selectedIds.size > 0 && !isAllSelected}
                                        onChange={toggleSelectAll}
                                    />
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#4b5563' }}>
                                        {selectedIds.size > 0 ? `Selected ${selectedIds.size} items` : 'Select All'}
                                    </span>
                                </div>

                                <List
                                    itemLayout="horizontal"
                                    dataSource={displayList}
                                    split={true}
                                    renderItem={(item) => (
                                        <List.Item 
                                            key={item.id}
                                            style={{ 
                                                padding: '18px 24px',
                                                backgroundColor: item.isRead ? 'transparent' : 'rgba(79, 70, 229, 0.02)',
                                                transition: 'all 0.2s ease',
                                                borderBottom: '1px solid #f3f4f6'
                                            }}
                                            className="broadcast-row-interactive"
                                        >
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, width: '100%' }}>
                                                {/* Checkbox selector */}
                                                <div style={{ display: 'flex', alignItems: 'center', height: '40px', alignSelf: 'center' }}>
                                                    <Checkbox
                                                        checked={selectedIds.has(item.id)}
                                                        onChange={() => toggleRowSelect(item.id)}
                                                    />
                                                </div>

                                                {/* Left Status Indicator Icon */}
                                                <Avatar 
                                                    size={40}
                                                    style={{ 
                                                        backgroundColor: `${getTypeColor(item.type)}10`, 
                                                        color: getTypeColor(item.type),
                                                        border: `1.5px solid ${getTypeColor(item.type)}20`,
                                                        flexShrink: 0,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        marginTop: 2
                                                    }}
                                                    icon={getTypeIcon(item.type)}
                                                />

                                                {/* Center Telemetry Summary */}
                                                <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <Space size="small">
                                                            <Tag color={getTypeColor(item.type)} style={{ 
                                                                borderRadius: 6, 
                                                                fontSize: 10, 
                                                                fontWeight: 800, 
                                                                letterSpacing: '0.05em',
                                                                border: 'none',
                                                                padding: '1px 8px',
                                                                lineHeight: '18px'
                                                            }}>
                                                                {getTypeLabel(item.type)}
                                                            </Tag>
                                                            {!item.isRead && (
                                                                <Badge status="processing" style={{ marginLeft: 4 }} text={
                                                                    <span style={{ fontSize: 10, fontWeight: 800, color: '#1976D2' }}>NEW</span>
                                                                } />
                                                            )}
                                                        </Space>
                                                        
                                                        <Space size={4} style={{ color: '#9ca3af', fontSize: 11.5 }}>
                                                            <Calendar size={12} />
                                                            <Text type="secondary" style={{ fontSize: 11.5, fontWeight: 550 }}>
                                                                {formatTimestamp(item.createdAt)}
                                                            </Text>
                                                        </Space>
                                                    </div>
                                                    
                                                    <Text 
                                                        strong={!item.isRead} 
                                                        style={{ 
                                                            fontSize: 13.5, 
                                                            color: item.isRead ? '#4b5563' : '#111827',
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
                                                                    icon={<Check size={15} style={{ color: '#2E7D32' }} />}
                                                                    style={{ 
                                                                        backgroundColor: '#f0fdf4', 
                                                                        border: '1px solid #dcfce7',
                                                                        borderRadius: 8,
                                                                        width: 32,
                                                                        height: 32,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center'
                                                                    }}
                                                                />
                                                            </Tooltip>
                                                        )}
                                                        <Popconfirm
                                                            title="Purge this broadcast?"
                                                            description="Proceed to erase from logging queue?"
                                                            okText="Purge"
                                                            cancelText="Cancel"
                                                            okButtonProps={{ danger: true, style: { borderRadius: 6 } }}
                                                            cancelButtonProps={{ style: { borderRadius: 6 } }}
                                                            onConfirm={() => dismissAlert(item.id)}
                                                            placement="left"
                                                        >
                                                            <Tooltip title="Purge Trace">
                                                                <Button 
                                                                    type="text" 
                                                                    size="middle"
                                                                    danger
                                                                    icon={<Trash2 size={14} />}
                                                                    style={{ 
                                                                        backgroundColor: '#fef2f2', 
                                                                        border: '1px solid #fee2e2',
                                                                        borderRadius: 8,
                                                                        width: 32,
                                                                        height: 32,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center'
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
                            </div>
                        )}
                    </Card>
                </Spin>

                {/* Floating Batch Actions Bar */}
                {selectedIds.size > 0 && (
                    <div style={{
                        position: 'fixed',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#1f2937',
                        borderRadius: '12px',
                        padding: '12px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        zIndex: 1000,
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
                        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                        <span style={{ color: '#fff', fontSize: '13px', fontWeight: 650 }}>
                            {selectedIds.size} alert{selectedIds.size > 1 ? 's' : ''} selected
                        </span>
                        
                        <div style={{ width: '1px', height: '16px', backgroundColor: '#4b5563' }} />

                        <Space size="middle">
                            <Button
                                type="text"
                                size="small"
                                onClick={handleBulkAcknowledge}
                                loading={actionLoading}
                                icon={<Check size={14} style={{ color: '#34d399' }} />}
                                style={{ color: '#fff', fontWeight: 600, fontSize: '12.5px', height: 32, display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                Mark Read
                            </Button>
                            <Button
                                type="text"
                                size="small"
                                danger
                                onClick={handleBulkDelete}
                                loading={actionLoading}
                                icon={<Trash2 size={13} />}
                                style={{ fontWeight: 600, fontSize: '12.5px', height: 32, display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                Delete
                            </Button>
                        </Space>
                    </div>
                )}

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
                        background-color: #1976D2;
                        animation: pulse-bar 1.6s infinite ease-in-out;
                    }
                    @keyframes pulse-bar {
                        0% { margin-left: -30%; }
                        100% { margin-left: 100%; }
                    }
                    .broadcast-row-interactive:hover {
                        background-color: #f9fafb !important;
                    }
                    @keyframes slideUp {
                        from { transform: translate(-50%, 20px); opacity: 0; }
                        to { transform: translate(-50%, 0); opacity: 1; }
                    }
                `}</style>
            </div>
        </ConfigProvider>
    );
};

export default AlertsPage;